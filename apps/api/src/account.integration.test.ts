import { createDatabaseClient, migrateDatabase } from '@torkout/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

const { db, pool } = createDatabaseClient(connectionString);
const userIds = {
  admin: '20000000-0000-4000-8000-000000000001',
  first: '20000000-0000-4000-8000-000000000002',
  second: '20000000-0000-4000-8000-000000000003',
} as const;
const deletedUsers: string[] = [];

const fakeAuth = {
  api: {
    async deleteUser(input: { headers: Headers }) {
      const userId = input.headers.get('x-user-id');
      if (userId) deletedUsers.push(userId);
      return { success: true };
    },
    async getSession(input: { headers: Headers }) {
      const userId = input.headers.get('x-user-id');
      if (!userId) return null;
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

function authenticatedHeaders(userId: string) {
  return {
    origin: 'https://torkout.example.test',
    'x-user-id': userId,
  };
}

describe('account, privacy and profile API', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
    await pool.query(
      `insert into users (id, name, email, email_verified, role) values
       ($1, 'Admin', 'admin@example.invalid', true, 'admin'),
       ($2, 'Primeira', 'first@example.invalid', true, 'user'),
       ($3, 'Segunda', 'second@example.invalid', true, 'user')`,
      [userIds.admin, userIds.first, userIds.second],
    );
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('publishes all current privacy documents without authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/privacy/documents' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      documents: [
        { type: 'privacy_notice', version: '2026-07-14' },
        { type: 'terms', version: '2026-07-14' },
        { type: 'health_data_consent', version: '2026-07-14' },
      ],
    });
  });

  it('creates onboarding and versioned acceptances only for the session user', async () => {
    const untrusted = await app.inject({
      headers: { origin: 'https://evil.example.test', 'x-user-id': userIds.first },
      method: 'PUT',
      payload: {},
      url: '/api/v1/profile',
    });
    expect(untrusted.statusCode).toBe(403);

    const profile = await app.inject({
      headers: authenticatedHeaders(userIds.first),
      method: 'PUT',
      payload: {
        displayName: 'Perfil A',
        enabledInitialHabits: ['coffee', 'protein'],
        heightCm: 171,
        initialWeightKg: 70,
        initialWaistCm: 80,
        locale: 'pt-BR',
        nonMedicalDisclaimerAccepted: true,
        preferredWorkoutTime: '07:30',
        timeZone: 'America/Cuiaba',
        unitSystem: 'metric',
      },
      url: '/api/v1/profile',
    });
    expect(profile.statusCode).toBe(200);

    const acceptance = await app.inject({
      headers: authenticatedHeaders(userIds.first),
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
    expect(acceptance.statusCode).toBe(204);

    const firstProfile = await app.inject({
      headers: authenticatedHeaders(userIds.first),
      method: 'GET',
      url: '/api/v1/profile',
    });
    expect(firstProfile.json()).toMatchObject({ displayName: 'Perfil A', heightCm: 171 });

    const secondProfile = await app.inject({
      headers: authenticatedHeaders(userIds.second),
      method: 'GET',
      url: '/api/v1/profile',
    });
    expect(secondProfile.statusCode).toBe(404);
    expect(secondProfile.body).not.toContain('Perfil A');

    const rows = await pool.query<{ user_id: string }>(
      'select distinct user_id from privacy_acceptances',
    );
    expect(rows.rows).toEqual([{ user_id: userIds.first }]);
  });

  it('blocks abusive accounts only as an admin, revokes sessions and writes content-free audit', async () => {
    await pool.query(
      `insert into sessions (user_id, token, expires_at)
       values ($1, 'target-session-token', now() + interval '1 day')`,
      [userIds.second],
    );
    const denied = await app.inject({
      headers: authenticatedHeaders(userIds.first),
      method: 'PUT',
      payload: { expiresAt: null, reason: 'abuse' },
      url: `/api/v1/admin/users/${userIds.second}/block`,
    });
    expect(denied.statusCode).toBe(403);

    const blocked = await app.inject({
      headers: authenticatedHeaders(userIds.admin),
      method: 'PUT',
      payload: { expiresAt: null, reason: 'abuse' },
      url: `/api/v1/admin/users/${userIds.second}/block`,
    });
    expect(blocked.statusCode).toBe(204);

    const target = await pool.query<{ banned: boolean }>('select banned from users where id = $1', [
      userIds.second,
    ]);
    expect(target.rows[0]!.banned).toBe(true);
    expect(
      (await pool.query('select id from sessions where user_id = $1', [userIds.second])).rowCount,
    ).toBe(0);
    const audit = await pool.query<{ event_type: string; metadata: Record<string, unknown> }>(
      'select event_type, metadata from audit_events where subject_id = $1',
      [userIds.second],
    );
    expect(audit.rows[0]).toEqual({
      event_type: 'account.blocked',
      metadata: { expiresAt: null, reason: 'abuse' },
    });
    expect(JSON.stringify(audit.rows[0])).not.toMatch(/pain|weight|health|notes/i);
  });

  it('requires explicit confirmation and password before requesting account erasure', async () => {
    const invalid = await app.inject({
      headers: authenticatedHeaders(userIds.first),
      method: 'DELETE',
      payload: { confirmation: 'EXCLUIR MINHA CONTA', password: 'wrong-password' },
      url: '/api/v1/account',
    });
    expect(invalid.statusCode).toBe(401);

    const deleted = await app.inject({
      headers: authenticatedHeaders(userIds.first),
      method: 'DELETE',
      payload: { confirmation: 'EXCLUIR MINHA CONTA', password: 'correct-password' },
      url: '/api/v1/account',
    });
    expect(deleted.statusCode).toBe(204);
    expect(deletedUsers).toContain(userIds.first);
  });
});
