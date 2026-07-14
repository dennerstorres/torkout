import { createDatabaseClient, migrateDatabase } from '@torkout/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

const { db, pool } = createDatabaseClient(connectionString);
const users = {
  first: 'a9000000-0000-4000-8000-000000000001',
  second: 'a9000000-0000-4000-8000-000000000002',
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

function request(userId: string, url: string) {
  return app.inject({
    headers: { origin: 'https://torkout.example.test', 'x-user-id': userId },
    method: 'GET',
    url,
  });
}

describe('paginated history API', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
    await pool.query(
      `insert into users (id, name, email, email_verified) values
       ($1, 'Primeira', 'history-first@example.invalid', true),
       ($2, 'Segunda', 'history-second@example.invalid', true)`,
      [users.first, users.second],
    );
    await pool.query(
      `insert into workout_sessions
         (id, user_id, planned_local_date, type, status, source, template_name_snapshot, time_zone)
       values
         ('a9100000-0000-4000-8000-000000000001', $1, '2026-07-12', 'rest', 'planned', 'ad_hoc', 'Descanso', 'America/Cuiaba'),
         ('a9100000-0000-4000-8000-000000000002', $1, '2026-07-13', 'strength', 'partial', 'ad_hoc', 'ForÃ§a A', 'America/Cuiaba'),
         ('a9100000-0000-4000-8000-000000000003', $1, '2026-07-13', 'walk', 'completed', 'ad_hoc', 'Caminhada', 'America/Cuiaba'),
         ('a9100000-0000-4000-8000-000000000004', $2, '2026-07-13', 'other', 'completed', 'ad_hoc', 'Privado', 'America/Cuiaba')`,
      [users.first, users.second],
    );
    await pool.query(
      `insert into pain_reports (id, user_id, local_date, type, intensity, moment, body_region)
       values ('a9200000-0000-4000-8000-000000000001', $1, '2026-07-13', 'joint', 'light', 'after', 'knee')`,
      [users.first],
    );
    await pool.query(
      `insert into body_measurements (id, user_id, local_date, measured_at, weight_kg)
       values ('a9300000-0000-4000-8000-000000000001', $1, '2026-07-13', now(), 80)`,
      [users.first],
    );
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('paginates by civil date, keeps multiple activity types, and isolates the user', async () => {
    const firstPage = await request(
      users.first,
      '/api/v1/history?from=2026-07-12&through=2026-07-13&limit=1',
    );
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.json()).toMatchObject({
      days: [{ localDate: '2026-07-12', sessions: [expect.objectContaining({ type: 'rest' })] }],
    });
    expect(firstPage.json().nextCursor).toEqual(expect.any(String));

    const secondPage = await request(
      users.first,
      `/api/v1/history?from=2026-07-12&through=2026-07-13&limit=1&cursor=${encodeURIComponent(firstPage.json().nextCursor)}`,
    );
    expect(secondPage.statusCode).toBe(200);
    expect(secondPage.json().days[0]).toMatchObject({
      localDate: '2026-07-13',
      measurements: [expect.objectContaining({ weightKg: 80 })],
      painReports: [expect.objectContaining({ bodyRegion: 'knee' })],
    });
    expect(
      secondPage.json().days[0].sessions.map((session: { type: string }) => session.type),
    ).toEqual(['strength', 'walk']);
    expect(secondPage.json().nextCursor).toBeNull();

    const isolated = await request(
      users.second,
      '/api/v1/history?from=2026-07-12&through=2026-07-12&limit=1',
    );
    expect(isolated.json().days[0].sessions).toEqual([]);
  });
});
