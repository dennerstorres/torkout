import { createDatabaseClient, migrateDatabase } from '@torkout/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

const { db, pool } = createDatabaseClient(connectionString);
const users = {
  first: 'd1000000-0000-4000-8000-000000000001',
  second: 'd1000000-0000-4000-8000-000000000002',
};
const devices = {
  first: 'd2000000-0000-4000-8000-000000000001',
  second: 'd2000000-0000-4000-8000-000000000002',
};

const app = buildApp({
  auth: {
    api: {
      async deleteUser() {
        return { success: true };
      },
      async getSession(input: { headers: Headers }) {
        const userId = input.headers.get('x-user-id');
        return userId
          ? {
              session: { id: `release-${userId}`, userId },
              user: { emailVerified: true, id: userId },
            }
          : null;
      },
      async verifyPassword() {
        return { status: true };
      },
    },
    async handler() {
      return new Response(null, { status: 501 });
    },
  },
  database: db,
  trustedOrigins: ['https://torkout.example.test'],
});

function headers(userId: string) {
  return { origin: 'https://torkout.example.test', 'x-user-id': userId };
}

function operation(input: {
  baseVersion: null | number;
  deviceId: string;
  operation: 'create' | 'update';
  operationId: string;
  weightKg: number;
}) {
  return {
    baseVersion: input.baseVersion,
    clientOccurredAt: '2026-07-15T14:00:00.000Z',
    deviceId: input.deviceId,
    entityId: 'd3000000-0000-4000-8000-000000000001',
    entityType: 'body_measurement',
    operation: input.operation,
    operationId: input.operationId,
    payload:
      input.operation === 'create'
        ? {
            localDate: '2026-07-15',
            measuredAt: '2026-07-15T14:00:00.000Z',
            weightKg: input.weightKg,
          }
        : { weightKg: input.weightKg },
  };
}

async function push(userId: string, payload: unknown) {
  return app.inject({
    headers: headers(userId),
    method: 'POST',
    payload: { operations: [payload] },
    url: '/api/v1/sync/push',
  });
}

describe('1.0 release compatibility', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
    await pool.query(
      `insert into users (id, name, email, email_verified) values
       ($1, 'Primeira', 'release-first@example.invalid', true),
       ($2, 'Segunda', 'release-second@example.invalid', true)`,
      [users.first, users.second],
    );
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('detects a genuine two-device stale write and keeps the other user isolated', async () => {
    const created = await push(
      users.first,
      operation({
        baseVersion: null,
        deviceId: devices.first,
        operation: 'create',
        operationId: 'd4000000-0000-4000-8000-000000000001',
        weightKg: 70,
      }),
    );
    expect(created.json().results[0]).toMatchObject({ record: { version: 1 }, status: 'applied' });

    const secondDevice = await push(
      users.first,
      operation({
        baseVersion: 1,
        deviceId: devices.second,
        operation: 'update',
        operationId: 'd4000000-0000-4000-8000-000000000002',
        weightKg: 71,
      }),
    );
    expect(secondDevice.json().results[0]).toMatchObject({
      record: { version: 2, weightKg: 71 },
      status: 'applied',
    });

    const staleFirstDevice = await push(
      users.first,
      operation({
        baseVersion: 1,
        deviceId: devices.first,
        operation: 'update',
        operationId: 'd4000000-0000-4000-8000-000000000003',
        weightKg: 72,
      }),
    );
    expect(staleFirstDevice.json().results[0]).toMatchObject({
      errorCode: 'version_conflict',
      record: { version: 2, weightKg: 71 },
      status: 'conflict',
    });

    const isolatedPull = await app.inject({
      headers: headers(users.second),
      method: 'GET',
      url: '/api/v1/sync/pull?limit=100',
    });
    expect(isolatedPull.json().changes).toEqual([]);
  });

  it('rejects an attempt by another user to update the first user record', async () => {
    const response = await push(
      users.second,
      operation({
        baseVersion: 2,
        deviceId: 'd2000000-0000-4000-8000-000000000003',
        operation: 'update',
        operationId: 'd4000000-0000-4000-8000-000000000004',
        weightKg: 73,
      }),
    );
    expect(response.json().results[0]).toMatchObject({
      errorCode: 'entity_not_found',
      status: 'rejected',
    });
    const stored = await pool.query<{ weight_kg: string }>(
      'select weight_kg::text from body_measurements where id = $1',
      ['d3000000-0000-4000-8000-000000000001'],
    );
    expect(stored.rows[0]?.weight_kg).toBe('71.00');
  });

  it('accepts the previous app legal versions after the additive release upgrade', async () => {
    const response = await app.inject({
      headers: headers(users.first),
      method: 'POST',
      payload: {
        documentVersions: {
          health_data_consent: '2026-07-14',
          privacy_notice: '2026-07-14',
          terms: '2026-07-14',
        },
      },
      url: '/api/v1/privacy/acceptances',
    });
    expect(response.statusCode).toBe(204);

    const accepted = await pool.query<{ version: string }>(
      `select document.version
       from privacy_acceptances acceptance
       join privacy_documents document on document.id = acceptance.document_id
       where acceptance.user_id = $1
       order by document.type`,
      [users.first],
    );
    expect(accepted.rows.map(({ version }) => version)).toEqual([
      '2026-07-14',
      '2026-07-14',
      '2026-07-14',
    ]);
  });
});
