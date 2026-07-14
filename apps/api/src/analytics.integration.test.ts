import { createDatabaseClient, migrateDatabase } from '@torkout/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

const { db, pool } = createDatabaseClient(connectionString);
const users = {
  first: 'c9000000-0000-4000-8000-000000000001',
  reference: 'c9000000-0000-4000-8000-000000000003',
  second: 'c9000000-0000-4000-8000-000000000002',
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

describe('progress analytics API', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
    await pool.query(
      `insert into users (id, name, email, email_verified) values
       ($1, 'AnalÃ­tica', 'analytics-first@example.invalid', true),
       ($2, 'Privada', 'analytics-second@example.invalid', true),
       ($3, 'ReferÃªncia', 'analytics-reference@example.invalid', true)`,
      [users.first, users.second, users.reference],
    );
    await pool.query(
      `insert into workout_sessions
         (id, user_id, planned_local_date, type, status, source, template_name_snapshot, time_zone)
       values
         ('c9100000-0000-4000-8000-000000000001', $1, '2026-07-06', 'strength', 'completed', 'ad_hoc', 'ForÃ§a', 'America/Cuiaba'),
         ('c9100000-0000-4000-8000-000000000002', $1, '2026-07-07', 'walk', 'partial', 'ad_hoc', 'Caminhada', 'America/Cuiaba'),
         ('c9100000-0000-4000-8000-000000000003', $1, '2026-07-08', 'rest', 'planned', 'ad_hoc', 'Descanso', 'America/Cuiaba'),
         ('c9100000-0000-4000-8000-000000000004', $2, '2026-07-06', 'strength', 'completed', 'ad_hoc', 'Privado', 'America/Cuiaba')`,
      [users.first, users.second],
    );
    await pool.query(
      `insert into session_exercises
         (id, user_id, session_id, exercise_id, exercise_name_snapshot, tracking_metric_snapshot, sort_order, status)
       values
         ('c9200000-0000-4000-8000-000000000001', $1, 'c9100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'FlexÃ£o', 'repetitions', 0, 'completed'),
         ('c9200000-0000-4000-8000-000000000002', $1, 'c9100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Agachamento livre', 'repetitions', 1, 'skipped')`,
      [users.first],
    );
    await pool.query(
      `insert into exercise_sets
         (id, user_id, session_exercise_id, set_number, planned_repetitions, actual_repetitions, completed, deleted_at)
       values
         ('c9300000-0000-4000-8000-000000000001', $1, 'c9200000-0000-4000-8000-000000000001', 1, 12, 12, true, null),
         ('c9300000-0000-4000-8000-000000000002', $1, 'c9200000-0000-4000-8000-000000000001', 2, 12, 10, true, null),
         ('c9300000-0000-4000-8000-000000000003', $1, 'c9200000-0000-4000-8000-000000000001', 3, 12, 99, true, now()),
         ('c9300000-0000-4000-8000-000000000004', $1, 'c9200000-0000-4000-8000-000000000002', 1, 15, 15, true, null)`,
      [users.first],
    );
    await pool.query(
      `insert into walking_details
         (id, user_id, session_id, actual_distance_meters, duration_seconds, distance_source)
       values ('c9400000-0000-4000-8000-000000000001', $1, 'c9100000-0000-4000-8000-000000000002', 2500, 1800, 'manual')`,
      [users.first],
    );
    await pool.query(
      `insert into body_measurements (id, user_id, local_date, measured_at, weight_kg, waist_cm)
       values ('c9500000-0000-4000-8000-000000000001', $1, '2026-07-06', '2026-07-06T12:00:00Z', 80, 91)`,
      [users.first],
    );
    await pool.query(
      `insert into pain_reports
         (id, user_id, local_date, type, intensity, moment, body_region, created_at)
       values ('c9600000-0000-4000-8000-000000000001', $1, '2026-07-06', 'joint', 'moderate', 'next_day', 'knee', '2026-07-10T12:00:00Z')`,
      [users.first],
    );
    await pool.query(
      `insert into workout_sessions
         (id, user_id, planned_local_date, type, status, source, template_name_snapshot, time_zone)
       select
         ('c9700000-0000-4000-8000-' || lpad(to_hex(day_number), 12, '0'))::uuid,
         $1,
         local_date,
         'strength',
         case when day_number % 5 = 0 then 'partial'::workout_status else 'completed'::workout_status end,
         'ad_hoc',
         'Dataset de referÃªncia',
         'America/Cuiaba'
       from generate_series(date '2025-07-13', date '2026-07-12', interval '1 day')
         with ordinality as days(local_date, day_number)`,
      [users.reference],
    );
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('returns explained aggregates for an inclusive range without removed or skipped series', async () => {
    const response = await request(
      users.first,
      '/api/v1/progress?from=2026-07-06&through=2026-07-12',
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      consistency: {
        formulaVersion: 'weekly-consistency/v1',
        weeks: [{ completedEquivalent: 1.5, percentage: 75, plannedExecutable: 2 }],
      },
      exercises: [{ name: 'FlexÃ£o', total: 22 }],
      measurements: [{ waistCm: 91, weightKg: 80 }],
      pain: [{ bodyRegion: 'knee', count: 1, intensity: 'moderate', type: 'joint' }],
      range: { from: '2026-07-06', through: '2026-07-12' },
      sessions: { completed: 1, partial: 1 },
      walks: { distanceMeters: 2500, frequencyPerWeek: 1, sessions: 1 },
    });
  });

  it('validates range, requires authentication and isolates another user', async () => {
    const invalid = await request(
      users.first,
      '/api/v1/progress?from=2026-07-12&through=2026-07-06',
    );
    expect(invalid.statusCode).toBe(400);

    const unauthenticated = await app.inject({
      method: 'GET',
      url: '/api/v1/progress?from=2026-07-06&through=2026-07-12',
    });
    expect(unauthenticated.statusCode).toBe(401);

    const isolated = await request(
      users.second,
      '/api/v1/progress?from=2026-07-06&through=2026-07-12',
    );
    expect(isolated.statusCode).toBe(200);
    expect(isolated.json().exercises).toEqual([]);
    expect(isolated.json().measurements).toEqual([]);
    expect(isolated.json().pain).toEqual([]);
  });

  it('keeps the bounded aggregate query below the common-operation target', async () => {
    const startedAt = performance.now();
    const response = await request(
      users.reference,
      '/api/v1/progress?from=2025-07-13&through=2026-07-12',
    );
    expect(response.statusCode).toBe(200);
    expect(response.json().sessions.completed + response.json().sessions.partial).toBe(365);
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});
