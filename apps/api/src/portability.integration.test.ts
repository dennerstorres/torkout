import { dataExportSchema } from '@torkout/contracts';
import {
  auditEvents,
  bodyMeasurements,
  createDatabaseClient,
  migrateDatabase,
  registeredDevices,
  sessions,
  userProfiles,
  users,
} from '@torkout/database';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { listZipEntries } from './export-package.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

const { db, pool } = createDatabaseClient(connectionString);
const userIds = {
  first: '21000000-0000-4000-8000-000000000001',
  second: '21000000-0000-4000-8000-000000000002',
} as const;
const deletedUsers = new Set<string>();

const fakeAuth = {
  api: {
    async deleteUser(input: { headers: Headers }) {
      const userId = input.headers.get('x-user-id');
      if (userId) {
        await db.delete(users).where(eq(users.id, userId));
        deletedUsers.add(userId);
      }
      return { success: true };
    },
    async getSession(input: { headers: Headers }) {
      const userId = input.headers.get('x-user-id');
      if (!userId || deletedUsers.has(userId)) return null;
      return {
        session: { id: `session-${userId}`, userId },
        user: { emailVerified: true, id: userId },
      };
    },
    async verifyPassword(input: { body: { password: string } }) {
      if (input.body.password !== 'correct-password') throw new Error('invalid password');
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

describe('data portability and erasure API', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
    await db.insert(users).values([
      {
        email: 'first@example.invalid',
        emailVerified: true,
        id: userIds.first,
        name: 'Primeira pessoa',
      },
      {
        email: 'second@example.invalid',
        emailVerified: true,
        id: userIds.second,
        name: 'Segunda pessoa',
      },
    ]);
    await db.insert(userProfiles).values([
      { id: '22000000-0000-4000-8000-000000000001', userId: userIds.first },
      { id: '22000000-0000-4000-8000-000000000002', userId: userIds.second },
    ]);
    await db.insert(bodyMeasurements).values([
      {
        id: '23000000-0000-4000-8000-000000000001',
        localDate: '2026-07-14',
        measuredAt: new Date('2026-07-14T15:00:00.000Z'),
        notes: 'medição da primeira pessoa',
        userId: userIds.first,
        weightKg: '70.00',
      },
      {
        id: '23000000-0000-4000-8000-000000000002',
        localDate: '2026-07-14',
        measuredAt: new Date('2026-07-14T15:00:00.000Z'),
        notes: 'dado privado da segunda pessoa',
        userId: userIds.second,
        weightKg: '80.00',
      },
    ]);
    await db.insert(sessions).values({
      expiresAt: new Date('2026-08-14T15:00:00.000Z'),
      token: 'server-session-secret',
      userId: userIds.first,
    });
    await db.insert(registeredDevices).values({
      createdAt: new Date('2026-07-14T15:00:00.000Z'),
      deviceKeyHash: 'internal-device-hash',
      id: '24000000-0000-4000-8000-000000000001',
      offlineAuthorizedUntil: new Date('2026-08-13T15:00:00.000Z'),
      userId: userIds.first,
    });
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('exports a versioned round-trippable JSON package scoped to the authenticated user', async () => {
    const response = await app.inject({
      headers: headers(userIds.first),
      method: 'POST',
      payload: {
        format: 'json',
        pendingChanges: [
          {
            baseVersion: null,
            clientOccurredAt: '2026-07-14T16:00:00.000Z',
            entityId: '23000000-0000-4000-8000-000000000003',
            entityType: 'body_measurement',
            operation: 'create',
            origin: 'local_pending',
            payload: {
              localDate: '2026-07-14',
              measuredAt: '2026-07-14T16:00:00.000Z',
              weightKg: 71,
            },
          },
        ],
      },
      url: '/api/v1/exports',
    });

    expect(response.statusCode).toBe(200);
    const exported = dataExportSchema.parse(response.json());
    expect(exported.formatVersion).toBe('1.0.0');
    expect(exported.timeZone).toBe('America/Cuiaba');
    expect(exported.entities.bodyMeasurements).toEqual([
      expect.objectContaining({ notes: 'medição da primeira pessoa', userId: userIds.first }),
    ]);
    expect(exported.pendingChanges).toEqual([
      expect.objectContaining({ origin: 'local_pending', operation: 'create' }),
    ]);
    expect(response.body).not.toContain('dado privado da segunda pessoa');
    expect(response.body).not.toMatch(/server-session-secret|internal-device-hash|password|token/i);
    expect(dataExportSchema.parse(JSON.parse(JSON.stringify(exported)))).toEqual(exported);
  });

  it('delivers normalized CSVs as a ZIP with accents preserved', async () => {
    const response = await app.inject({
      headers: headers(userIds.first),
      method: 'POST',
      payload: { format: 'csv_zip', pendingChanges: [] },
      url: '/api/v1/exports',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/zip');
    expect(response.headers['content-disposition']).toMatch(/torkout-export.*\.zip/);
    const entries = listZipEntries(response.rawPayload);
    expect(entries.get('body_measurements.csv')?.toString('utf8')).toContain(
      'medição da primeira pessoa',
    );
    expect(entries.get('body_measurements.csv')?.toString('utf8')).not.toContain(
      'dado privado da segunda pessoa',
    );
  });

  it('deletes active account data, discloses backup retention and revokes access', async () => {
    const response = await app.inject({
      headers: headers(userIds.first),
      method: 'DELETE',
      payload: { confirmation: 'EXCLUIR MINHA CONTA', password: 'correct-password' },
      url: '/api/v1/account',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      activeDataDeleted: true,
      backupRetention: { maximumDays: 365 },
    });
    expect(await db.select().from(users).where(eq(users.id, userIds.first))).toHaveLength(0);
    expect(
      await db.select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, userIds.first)),
    ).toHaveLength(0);
    expect(
      await db.select().from(registeredDevices).where(eq(registeredDevices.userId, userIds.first)),
    ).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, userIds.first))).toHaveLength(
      0,
    );
    expect(
      await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.eventType, 'account.deletion_requested')),
    ).toEqual([
      expect.objectContaining({
        eventType: 'account.deletion_requested',
        subjectId: null,
        userId: null,
      }),
    ]);

    const denied = await app.inject({
      headers: headers(userIds.first),
      method: 'POST',
      payload: { format: 'json', pendingChanges: [] },
      url: '/api/v1/exports',
    });
    expect(denied.statusCode).toBe(401);
  });
});
