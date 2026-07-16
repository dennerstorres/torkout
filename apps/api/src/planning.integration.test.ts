import { SYSTEM_EXERCISES } from '@torkout/contracts';
import { createDatabaseClient, migrateDatabase } from '@torkout/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

const { db, pool } = createDatabaseClient(connectionString);
const users = {
  first: '91000000-0000-4000-8000-000000000001',
  second: '91000000-0000-4000-8000-000000000002',
};
const ids = {
  customExercise: '92000000-0000-4000-8000-000000000001',
  plan: '92000000-0000-4000-8000-000000000002',
  ruleMonday: '92000000-0000-4000-8000-000000000003',
  ruleMondaySecond: '92000000-0000-4000-8000-000000000004',
  template: '92000000-0000-4000-8000-000000000005',
  templateExercise: '92000000-0000-4000-8000-000000000006',
  templateSet: '92000000-0000-4000-8000-000000000007',
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

async function request(
  userId: string,
  method: 'DELETE' | 'GET' | 'POST' | 'PUT',
  url: string,
  payload?: Record<string, unknown>,
) {
  return app.inject({
    headers: headers(userId),
    method,
    ...(payload === undefined ? {} : { payload }),
    url,
  });
}

describe('planning API', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
    await pool.query(
      `insert into users (id, name, email, email_verified) values
       ($1, 'Primeira', 'planning-first@example.invalid', true),
       ($2, 'Segunda', 'planning-second@example.invalid', true)`,
      [users.first, users.second],
    );
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('lists the initial catalog and manages a custom exercise without deleting history', async () => {
    const catalog = await request(users.first, 'GET', '/api/v1/exercises');
    expect(catalog.statusCode).toBe(200);
    expect(catalog.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: SYSTEM_EXERCISES.pushUp.id, name: 'Flexão' }),
        expect.objectContaining({ id: SYSTEM_EXERCISES.squat.id, name: 'Agachamento livre' }),
      ]),
    );

    const created = await request(users.first, 'POST', '/api/v1/exercises', {
      category: 'Força',
      id: ids.customExercise,
      name: 'Remada',
      trackingMetric: 'repetitions',
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ active: true, id: ids.customExercise, version: 1 });

    const denied = await request(users.second, 'PUT', `/api/v1/exercises/${ids.customExercise}`, {
      name: 'Invadido',
      version: 1,
    });
    expect(denied.statusCode).toBe(404);

    const deactivated = await request(
      users.first,
      'DELETE',
      `/api/v1/exercises/${ids.customExercise}?version=1`,
    );
    expect(deactivated.statusCode).toBe(200);
    expect(deactivated.json()).toMatchObject({ active: false, version: 2 });
  });

  it('creates a plan/template and materializes snapshots idempotently with multiple sessions per day', async () => {
    expect(
      (
        await request(users.first, 'POST', '/api/v1/plans', {
          id: ids.plan,
          name: 'Plano principal',
          status: 'active',
          validFrom: '2026-07-01',
        })
      ).statusCode,
    ).toBe(201);

    const templatePayload = {
      exercises: [
        {
          exerciseId: SYSTEM_EXERCISES.pushUp.id,
          id: ids.templateExercise,
          name: 'Flexão',
          sets: [
            { id: ids.templateSet, setNumber: 1, targetRepetitions: 12 },
            { setNumber: 2, targetRepetitions: 12 },
          ],
          sortOrder: 0,
          trackingMetric: 'repetitions',
        },
      ],
      id: ids.template,
      name: 'Treino A',
      planId: ids.plan,
      rules: [
        {
          id: ids.ruleMonday,
          localTime: '18:00',
          timeZone: 'America/Cuiaba',
          validFrom: '2026-07-01',
          weekday: 1,
        },
        {
          id: ids.ruleMondaySecond,
          localTime: '20:00',
          timeZone: 'America/Cuiaba',
          validFrom: '2026-07-01',
          weekday: 1,
        },
      ],
      type: 'strength',
    };
    const template = await request(users.first, 'POST', '/api/v1/templates', templatePayload);
    expect(template.statusCode).toBe(201);

    const first = await request(users.first, 'POST', '/api/v1/sessions/materialize', {
      from: '2026-07-13',
      through: '2026-07-13',
    });
    const repeated = await request(users.first, 'POST', '/api/v1/sessions/materialize', {
      from: '2026-07-13',
      through: '2026-07-13',
    });
    expect(first.json()).toMatchObject({ created: 2 });
    expect(repeated.json()).toMatchObject({ created: 0 });

    const sessions = await request(
      users.first,
      'GET',
      '/api/v1/sessions?from=2026-07-13&through=2026-07-13',
    );
    expect(sessions.json().items).toHaveLength(2);
    expect(sessions.json().items[0]).toMatchObject({
      exercises: expect.arrayContaining([
        expect.objectContaining({
          name: 'Flexão',
          sets: expect.arrayContaining([expect.objectContaining({ plannedRepetitions: 12 })]),
        }),
      ]),
      templateNameSnapshot: 'Treino A',
    });
  });

  it('keeps historical snapshots while a future-effective edit rematerializes only planned future sessions', async () => {
    const sessionsBefore = (
      await request(users.first, 'GET', '/api/v1/sessions?from=2026-07-13&through=2026-07-13')
    ).json().items as Array<{ id: string; version: number }>;
    await request(users.first, 'PUT', `/api/v1/sessions/${sessionsBefore[0]!.id}`, {
      status: 'completed',
      version: sessionsBefore[0]!.version,
    });

    const currentTemplate = (
      await request(users.first, 'GET', `/api/v1/templates/${ids.template}`)
    ).json();
    const edited = await request(users.first, 'PUT', `/api/v1/templates/${ids.template}`, {
      ...currentTemplate,
      effectiveFrom: '2026-07-13',
      exercises: currentTemplate.exercises.map((exercise: Record<string, unknown>) => ({
        ...exercise,
        sets: [{ setNumber: 1, targetRepetitions: 20 }],
      })),
      version: currentTemplate.version,
    });
    expect(edited.statusCode).toBe(200);
    await request(users.first, 'POST', '/api/v1/sessions/materialize', {
      from: '2026-07-13',
      through: '2026-07-13',
    });

    const sessionsAfter = (
      await request(users.first, 'GET', '/api/v1/sessions?from=2026-07-13&through=2026-07-13')
    ).json().items;
    const historical = sessionsAfter.find(
      (session: { id: string }) => session.id === sessionsBefore[0]!.id,
    );
    expect(historical.exercises[0].sets).toEqual(
      expect.arrayContaining([expect.objectContaining({ plannedRepetitions: 12 })]),
    );
    expect(
      sessionsAfter.some(
        (session: { exercises: Array<{ sets: Array<{ plannedRepetitions?: number }> }> }) =>
          session.exercises[0]?.sets.some(
            (set: { plannedRepetitions?: number }) => set.plannedRepetitions === 20,
          ),
      ),
    ).toBe(true);
  });

  it('creates, reschedules and cancels an ad-hoc session while hiding it from another user', async () => {
    const created = await request(users.first, 'POST', '/api/v1/sessions', {
      exercises: [],
      plannedLocalDate: '2026-07-14',
      source: 'ad_hoc',
      suggestedLocalTime: '19:30',
      templateNameSnapshot: 'Mobilidade avulsa',
      timeZone: 'America/Cuiaba',
      type: 'other',
    });
    expect(created.statusCode).toBe(201);
    const recomposed = await request(users.first, 'PUT', `/api/v1/sessions/${created.json().id}`, {
      exercises: [
        {
          exerciseId: SYSTEM_EXERCISES.pushUp.id,
          name: 'Flexão',
          sets: [{ setNumber: 1, targetRepetitions: 10 }],
          sortOrder: 0,
          trackingMetric: 'repetitions',
        },
      ],
      templateNameSnapshot: 'Força avulsa',
      type: 'strength',
      version: created.json().version,
    });
    expect(recomposed.json()).toMatchObject({
      templateNameSnapshot: 'Força avulsa',
      type: 'strength',
    });
    expect(recomposed.json().exercises[0].sets[0]).toMatchObject({ plannedRepetitions: 10 });
    const rescheduled = await request(users.first, 'PUT', `/api/v1/sessions/${created.json().id}`, {
      plannedLocalDate: '2026-07-15',
      version: recomposed.json().version,
    });
    const cancelled = await request(users.first, 'PUT', `/api/v1/sessions/${created.json().id}`, {
      status: 'cancelled',
      version: rescheduled.json().version,
    });
    expect(cancelled.json()).toMatchObject({ plannedLocalDate: '2026-07-15', status: 'cancelled' });
    const immutable = await request(users.first, 'PUT', `/api/v1/sessions/${created.json().id}`, {
      exercises: [],
      templateNameSnapshot: 'Reescrito',
      type: 'rest',
      version: cancelled.json().version,
    });
    expect(immutable.statusCode).toBe(409);
    expect(
      (
        await request(users.second, 'GET', '/api/v1/sessions?from=2026-07-01&through=2026-07-31')
      ).json().items,
    ).toEqual([]);
  });

  it('synchronizes planning aggregates created offline and exposes them through incremental pull', async () => {
    const deviceId = '93000000-0000-4000-8000-000000000001';
    const offlineExerciseId = '93000000-0000-4000-8000-000000000002';
    const offlinePlanId = '93000000-0000-4000-8000-000000000003';
    const offlineTemplateId = '93000000-0000-4000-8000-000000000004';
    const offlineSessionId = '93000000-0000-4000-8000-000000000005';
    const operations = [
      {
        baseVersion: null,
        clientOccurredAt: '2026-07-14T18:00:00Z',
        deviceId,
        entityId: offlineExerciseId,
        entityType: 'exercise',
        operation: 'create',
        operationId: '93000000-0000-4000-8000-000000000010',
        payload: {
          category: 'Mobilidade',
          name: 'Alongamento offline',
          trackingMetric: 'duration',
        },
      },
      {
        baseVersion: null,
        clientOccurredAt: '2026-07-14T18:00:02Z',
        deviceId,
        entityId: offlineTemplateId,
        entityType: 'workout_template',
        operation: 'create',
        operationId: '93000000-0000-4000-8000-000000000012',
        payload: {
          exercises: [
            {
              exerciseId: offlineExerciseId,
              name: 'Alongamento offline',
              sets: [{ setNumber: 1, targetDurationSeconds: 60 }],
              sortOrder: 0,
              trackingMetric: 'duration',
            },
          ],
          name: 'Treino sincronizado',
          planId: offlinePlanId,
          rules: [],
          type: 'strength',
        },
      },
      {
        baseVersion: null,
        clientOccurredAt: '2026-07-14T18:00:03Z',
        deviceId,
        entityId: offlineSessionId,
        entityType: 'workout_session',
        operation: 'create',
        operationId: '93000000-0000-4000-8000-000000000013',
        payload: {
          exercises: [],
          plannedLocalDate: '2026-08-02',
          source: 'ad_hoc',
          templateNameSnapshot: 'Sessão offline',
          timeZone: 'America/Cuiaba',
          type: 'other',
        },
      },
      {
        baseVersion: null,
        clientOccurredAt: '2026-07-14T18:00:01Z',
        deviceId,
        entityId: offlinePlanId,
        entityType: 'training_plan',
        operation: 'create',
        operationId: '93000000-0000-4000-8000-000000000011',
        payload: {
          name: 'Plano offline',
          status: 'active',
          validFrom: '2026-08-01',
        },
      },
    ];
    operations.sort((left, right) => left.clientOccurredAt.localeCompare(right.clientOccurredAt));
    const pushed = await request(users.first, 'POST', '/api/v1/sync/push', { operations });
    expect(pushed.statusCode).toBe(200);
    expect(pushed.json().results).toEqual([
      expect.objectContaining({
        record: expect.objectContaining({ id: offlineExerciseId }),
        status: 'applied',
      }),
      expect.objectContaining({
        record: expect.objectContaining({ id: offlinePlanId }),
        status: 'applied',
      }),
      expect.objectContaining({
        record: expect.objectContaining({ id: offlineTemplateId }),
        status: 'applied',
      }),
      expect.objectContaining({
        record: expect.objectContaining({ id: offlineSessionId }),
        status: 'applied',
      }),
    ]);

    const pulled = await request(users.first, 'GET', '/api/v1/sync/pull?limit=100');
    expect(pulled.json().changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: offlineExerciseId, entityType: 'exercise' }),
        expect.objectContaining({ entityId: offlinePlanId, entityType: 'training_plan' }),
        expect.objectContaining({ entityId: offlineTemplateId, entityType: 'workout_template' }),
        expect.objectContaining({ entityId: offlineSessionId, entityType: 'workout_session' }),
      ]),
    );
  });

  it('archives templates and plans without deleting completed historical snapshots', async () => {
    const template = (
      await request(users.first, 'GET', `/api/v1/templates/${ids.template}`)
    ).json();
    const deletedTemplate = await request(
      users.first,
      'DELETE',
      `/api/v1/templates/${ids.template}?version=${template.version}`,
    );
    expect(deletedTemplate.statusCode).toBe(200);
    expect(deletedTemplate.json().deletedAt).toBeTruthy();

    const plan = (await request(users.first, 'GET', '/api/v1/plans'))
      .json()
      .items.find((item: { id: string }) => item.id === ids.plan);
    const deletedPlan = await request(
      users.first,
      'DELETE',
      `/api/v1/plans/${ids.plan}?version=${plan.version}`,
    );
    expect(deletedPlan.statusCode).toBe(200);
    const historical = await pool.query(
      `select session.id
       from workout_sessions session
       where session.template_id = $1 and session.status = 'completed' and session.deleted_at is null`,
      [ids.template],
    );
    expect(historical.rowCount).toBe(1);
  });
});
