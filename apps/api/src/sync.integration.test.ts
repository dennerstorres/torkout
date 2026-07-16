import { createDatabaseClient, migrateDatabase } from '@torkout/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

const { db, pool } = createDatabaseClient(connectionString);
const users = {
  first: '81000000-0000-4000-8000-000000000001',
  second: '81000000-0000-4000-8000-000000000002',
};
const devices = {
  first: '82000000-0000-4000-8000-000000000001',
  second: '82000000-0000-4000-8000-000000000002',
};

const fakeAuth = {
  api: {
    async deleteUser() {
      return { success: true };
    },
    async getSession(input: { headers: Headers }) {
      const userId = input.headers.get('x-user-id');
      return userId
        ? {
            session: { id: `session-${userId}`, userId },
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
};

const app = buildApp({
  auth: fakeAuth,
  database: db,
  trustedOrigins: ['https://torkout.example.test'],
});

function headers(userId: string) {
  return { origin: 'https://torkout.example.test', 'x-user-id': userId };
}

function createOperation(overrides: Record<string, unknown> = {}) {
  return {
    baseVersion: null,
    clientOccurredAt: '2026-07-14T15:00:00.000Z',
    deviceId: devices.first,
    entityId: '83000000-0000-4000-8000-000000000001',
    entityType: 'body_measurement',
    operation: 'create',
    operationId: '84000000-0000-4000-8000-000000000001',
    payload: {
      additionalMeasurements: [{ key: 'neck', label: 'Pescoço', unit: 'cm', value: 37.5 }],
      localDate: '2026-07-14',
      measuredAt: '2026-07-14T15:00:00.000Z',
      weightKg: 70,
    },
    ...overrides,
  };
}

async function push(userId: string, operations: unknown[]) {
  return app.inject({
    headers: headers(userId),
    method: 'POST',
    payload: { operations },
    url: '/api/v1/sync/push',
  });
}

describe('local-first sync API', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
    await pool.query(
      `insert into users (id, name, email, email_verified) values
       ($1, 'Primeira', 'sync-first@example.invalid', true),
       ($2, 'Segunda', 'sync-second@example.invalid', true)`,
      [users.first, users.second],
    );
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('rejects a malformed item without blocking the valid remainder of the batch', async () => {
    const valid = createOperation();
    const response = await push(users.first, [{ broken: true }, valid]);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      results: [
        { errorCode: 'invalid_operation', operationId: null, status: 'rejected' },
        {
          operationId: valid.operationId,
          record: {
            additionalMeasurements: [{ key: 'neck', label: 'Pescoço', unit: 'cm', value: 37.5 }],
            version: 1,
            weightKg: 70,
          },
          status: 'applied',
        },
      ],
    });
    const stored = await pool.query('select id from body_measurements where id = $1', [
      valid.entityId,
    ]);
    expect(stored.rowCount).toBe(1);
  });

  it('returns the persisted result when a committed operation is repeated after a lost response', async () => {
    const operation = createOperation({
      entityId: '83000000-0000-4000-8000-000000000002',
      operationId: '84000000-0000-4000-8000-000000000002',
    });
    const first = await push(users.first, [operation]);
    const repeated = await push(users.first, [operation]);

    expect(first.json().results[0]).toMatchObject({ status: 'applied' });
    expect(repeated.json().results[0]).toMatchObject({
      operationId: operation.operationId,
      record: { id: operation.entityId, version: 1 },
      status: 'duplicate',
    });
    expect(
      (await pool.query('select id from body_measurements where id = $1', [operation.entityId]))
        .rowCount,
    ).toBe(1);
    expect(
      (
        await pool.query('select id from sync_operations where operation_id = $1', [
          operation.operationId,
        ])
      ).rowCount,
    ).toBe(1);
  });

  it('detects stale versions and returns both server and local decision inputs', async () => {
    const entityId = '83000000-0000-4000-8000-000000000003';
    await push(users.first, [
      createOperation({ entityId, operationId: '84000000-0000-4000-8000-000000000003' }),
    ]);
    const updated = await push(users.first, [
      createOperation({
        baseVersion: 1,
        entityId,
        operation: 'update',
        operationId: '84000000-0000-4000-8000-000000000004',
        payload: { weightKg: 71 },
      }),
    ]);
    expect(updated.json().results[0]).toMatchObject({ record: { version: 2 }, status: 'applied' });

    const stale = await push(users.first, [
      createOperation({
        baseVersion: 1,
        entityId,
        operation: 'update',
        operationId: '84000000-0000-4000-8000-000000000005',
        payload: { weightKg: 72 },
      }),
    ]);
    expect(stale.json().results[0]).toMatchObject({
      errorCode: 'version_conflict',
      record: { version: 2, weightKg: 71 },
      status: 'conflict',
    });
  });

  it('handles operations arriving out of dependency order independently', async () => {
    const entityId = '83000000-0000-4000-8000-000000000004';
    const response = await push(users.first, [
      createOperation({
        baseVersion: 1,
        entityId,
        operation: 'update',
        operationId: '84000000-0000-4000-8000-000000000006',
        payload: { notes: 'adiantada' },
      }),
      createOperation({ entityId, operationId: '84000000-0000-4000-8000-000000000007' }),
    ]);

    expect(response.json().results).toMatchObject([
      { errorCode: 'entity_not_found', status: 'rejected' },
      { record: { version: 1 }, status: 'applied' },
    ]);
  });

  it('paginates an isolated change log and carries tombstones without resurrection payloads', async () => {
    const entityId = '83000000-0000-4000-8000-000000000005';
    await push(users.first, [
      createOperation({ entityId, operationId: '84000000-0000-4000-8000-000000000008' }),
      createOperation({
        baseVersion: 1,
        entityId,
        operation: 'delete',
        operationId: '84000000-0000-4000-8000-000000000009',
        payload: {},
      }),
    ]);

    const firstPage = await app.inject({
      headers: headers(users.first),
      method: 'GET',
      url: '/api/v1/sync/pull?limit=1',
    });
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.json()).toMatchObject({ hasMore: true });
    expect(firstPage.json().cursor).toEqual(expect.any(String));

    const all = await app.inject({
      headers: headers(users.first),
      method: 'GET',
      url: '/api/v1/sync/pull?limit=100',
    });
    const tombstone = all
      .json()
      .changes.find(
        (change: { entityId: string; operation: string }) =>
          change.entityId === entityId && change.operation === 'delete',
      );
    expect(tombstone).toMatchObject({ deletedAt: expect.any(String), payload: { version: 2 } });

    const isolated = await app.inject({
      headers: headers(users.second),
      method: 'GET',
      url: '/api/v1/sync/pull?limit=100',
    });
    expect(isolated.json().changes).toEqual([]);
  });

  it('does not allow another user to claim an already registered device', async () => {
    const response = await push(users.second, [
      createOperation({
        entityId: '83000000-0000-4000-8000-000000000006',
        operationId: '84000000-0000-4000-8000-000000000010',
      }),
    ]);
    expect(response.json().results[0]).toMatchObject({ status: 'unauthorized' });
  });
});
