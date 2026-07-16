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
  first: 'a6000000-0000-4000-8000-000000000001',
  second: 'a6000000-0000-4000-8000-000000000002',
};
const ids = {
  session: 'a6100000-0000-4000-8000-000000000001',
  exercise: 'a6100000-0000-4000-8000-000000000002',
  firstSet: 'a6100000-0000-4000-8000-000000000003',
  secondSet: 'a6100000-0000-4000-8000-000000000004',
  extraSet: 'a6100000-0000-4000-8000-000000000005',
  pain: 'a6200000-0000-4000-8000-000000000001',
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

async function request(
  userId: string,
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  payload?: Record<string, unknown>,
) {
  return app.inject({
    headers: { origin: 'https://torkout.example.test', 'x-user-id': userId },
    method,
    ...(payload ? { payload } : {}),
    url,
  });
}

describe('daily tracking API', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
    await pool.query(
      `insert into users (id, name, email, email_verified) values
       ($1, 'Primeira', 'daily-first@example.invalid', true),
       ($2, 'Segunda', 'daily-second@example.invalid', true)`,
      [users.first, users.second],
    );
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('updates actual sets incrementally without changing planned targets and calculates partiality', async () => {
    const created = await request(users.first, 'POST', '/api/v1/sessions', {
      exercises: [
        {
          exerciseId: SYSTEM_EXERCISES.pushUp.id,
          id: ids.exercise,
          name: 'Flexão',
          sets: [
            { id: ids.firstSet, setNumber: 1, targetRepetitions: 12 },
            { id: ids.secondSet, setNumber: 2, targetRepetitions: 12 },
          ],
          sortOrder: 0,
          trackingMetric: 'repetitions',
        },
      ],
      id: ids.session,
      plannedLocalDate: '2026-07-14',
      source: 'ad_hoc',
      templateNameSnapshot: 'Treino de hoje',
      timeZone: 'America/Cuiaba',
      type: 'strength',
    });
    expect(created.statusCode).toBe(201);

    const updated = await request(users.first, 'PUT', `/api/v1/sessions/${ids.session}/execution`, {
      execution: {
        exercises: [
          {
            id: ids.exercise,
            sets: [
              { actualRepetitions: 12, completed: true, id: ids.firstSet, setNumber: 1 },
              { actualRepetitions: 8, completed: false, id: ids.secondSet, setNumber: 2 },
              { actualRepetitions: 5, completed: true, id: ids.extraSet, setNumber: 3 },
            ],
            status: 'stopped',
          },
        ],
        jointPainStatus: 'unknown',
        startedAt: '2026-07-14T18:00:00.000Z',
      },
      version: created.json().version,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ jointPainStatus: 'unknown', status: 'partial' });
    expect(updated.json().exercises[0].sets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actualRepetitions: 8,
          id: ids.secondSet,
          plannedRepetitions: 12,
        }),
        expect.objectContaining({
          actualRepetitions: 5,
          id: ids.extraSet,
          plannedRepetitions: null,
        }),
      ]),
    );
  });

  it('records linked pain, keeps absent confirmation unknown and isolates another user', async () => {
    const pain = await request(users.first, 'POST', '/api/v1/pain-reports', {
      bodyRegion: 'ankle',
      exerciseId: SYSTEM_EXERCISES.pushUp.id,
      exerciseSetId: ids.secondSet,
      exerciseStopped: true,
      id: ids.pain,
      intensity: 'moderate',
      localDate: '2026-07-14',
      moment: 'during',
      sessionId: ids.session,
      type: 'joint',
    });
    expect(pain.statusCode).toBe(201);
    expect(pain.json()).toMatchObject({ exerciseSetId: ids.secondSet, type: 'joint' });

    const denied = await request(users.second, 'GET', '/api/v1/pain-reports?localDate=2026-07-14');
    expect(denied.json().items).toEqual([]);
  });

  it('creates initial choice habits, upserts one entry per date and accepts multiple measurements', async () => {
    const profile = await request(users.first, 'PUT', '/api/v1/profile', {
      displayName: 'Primeira',
      enabledInitialHabits: ['coffee', 'rice', 'protein', 'salad'],
      locale: 'pt-BR',
      nonMedicalDisclaimerAccepted: true,
      timeZone: 'America/Cuiaba',
      unitSystem: 'metric',
    });
    expect(profile.statusCode).toBe(200);

    const habits = await request(users.first, 'GET', '/api/v1/habits');
    expect(habits.statusCode).toBe(200);
    expect(habits.json().items).toHaveLength(4);
    expect(
      habits.json().items.every((habit: { options: unknown[] }) => habit.options.length >= 2),
    ).toBe(true);
    const coffee = habits.json().items.find((habit: { name: string }) => habit.name === 'Café');
    const firstEntry = await request(
      users.first,
      'PUT',
      `/api/v1/habits/${coffee.id}/entries/2026-07-14`,
      { selectedOptionId: coffee.options[1].id },
    );
    const editedEntry = await request(
      users.first,
      'PUT',
      `/api/v1/habits/${coffee.id}/entries/2026-07-14`,
      { selectedOptionId: coffee.options[2].id },
    );
    expect(firstEntry.statusCode).toBe(200);
    expect(editedEntry.json()).toMatchObject({ selectedOptionId: coffee.options[2].id });

    expect(
      (
        await request(users.first, 'POST', '/api/v1/measurements', {
          localDate: '2026-07-14',
          measuredAt: '2026-07-14T10:00:00.000Z',
          weightKg: 80,
        })
      ).statusCode,
    ).toBe(201);
    await request(users.first, 'POST', '/api/v1/measurements', {
      localDate: '2026-07-14',
      measuredAt: '2026-07-14T22:00:00.000Z',
      waistCm: 90,
    });
    const measurements = await request(
      users.first,
      'GET',
      '/api/v1/measurements?localDate=2026-07-14',
    );
    expect(measurements.json().items).toHaveLength(2);
  });

  it('edits choice labels while preserving option ids referenced by historical entries', async () => {
    const optionIds = [
      'a6400000-0000-4000-8000-000000000001',
      'a6400000-0000-4000-8000-000000000002',
    ];
    const created = await request(users.first, 'POST', '/api/v1/habits', {
      active: true,
      id: 'a6400000-0000-4000-8000-000000000010',
      name: 'Sono',
      options: [
        { id: optionIds[0], label: 'Ruim', sortOrder: 0, stableValue: 'poor' },
        { id: optionIds[1], label: 'Bom', sortOrder: 1, stableValue: 'good' },
      ],
      sortOrder: 20,
      type: 'choice',
    });
    expect(created.statusCode).toBe(201);
    await request(
      users.first,
      'PUT',
      '/api/v1/habits/a6400000-0000-4000-8000-000000000010/entries/2026-07-13',
      { selectedOptionId: optionIds[0] },
    );

    const updated = await request(
      users.first,
      'PUT',
      '/api/v1/habits/a6400000-0000-4000-8000-000000000010',
      {
        options: [
          { id: optionIds[0], label: 'Noite ruim', sortOrder: 0, stableValue: 'poor' },
          { id: optionIds[1], label: 'Noite boa', sortOrder: 1, stableValue: 'good' },
        ],
      },
    );

    expect(updated.statusCode).toBe(200);
    expect(updated.json().options).toEqual([
      expect.objectContaining({ id: optionIds[0], label: 'Noite ruim' }),
      expect.objectContaining({ id: optionIds[1], label: 'Noite boa' }),
    ]);
    const entries = await request(
      users.first,
      'GET',
      '/api/v1/habits/entries?localDate=2026-07-13',
    );
    expect(entries.json().items).toEqual([
      expect.objectContaining({ selectedOptionId: optionIds[0] }),
    ]);
  });

  it('synchronizes daily entities and execution with per-item results', async () => {
    const deviceId = 'a6300000-0000-4000-8000-000000000001';
    const session = (
      await request(users.first, 'GET', '/api/v1/sessions?from=2026-07-14&through=2026-07-14')
    )
      .json()
      .items.find((item: { id: string }) => item.id === ids.session);
    const habits = (await request(users.first, 'GET', '/api/v1/habits')).json().items;
    const coffee = habits.find((habit: { name: string }) => habit.name === 'Café');
    const operations = [
      {
        baseVersion: null,
        clientOccurredAt: '2026-07-14T19:59:59.000Z',
        deviceId,
        entityId: 'a6300000-0000-4000-8000-000000000040',
        entityType: 'habit_definition',
        operation: 'create',
        operationId: 'a6300000-0000-4000-8000-000000000041',
        payload: {
          active: true,
          name: 'Água',
          options: [],
          sortOrder: 10,
          type: 'quantity',
          unit: 'copos',
        },
      },
      {
        baseVersion: session.version,
        clientOccurredAt: '2026-07-14T20:00:00.000Z',
        deviceId,
        entityId: ids.session,
        entityType: 'workout_session',
        operation: 'update',
        operationId: 'a6300000-0000-4000-8000-000000000010',
        payload: {
          execution: {
            exercises: [
              {
                id: ids.exercise,
                sets: [
                  { actualRepetitions: 12, completed: true, id: ids.firstSet, setNumber: 1 },
                  { actualRepetitions: 12, completed: true, id: ids.secondSet, setNumber: 2 },
                  { actualRepetitions: 5, completed: true, id: ids.extraSet, setNumber: 3 },
                ],
                status: 'completed',
              },
            ],
            jointPainStatus: 'none',
          },
        },
      },
      {
        baseVersion: null,
        clientOccurredAt: '2026-07-14T20:00:01.000Z',
        deviceId,
        entityId: 'a6300000-0000-4000-8000-000000000020',
        entityType: 'habit_entry',
        operation: 'create',
        operationId: 'a6300000-0000-4000-8000-000000000021',
        payload: {
          habitDefinitionId: coffee.id,
          localDate: '2026-07-15',
          selectedOptionId: coffee.options[0].id,
        },
      },
      {
        baseVersion: null,
        clientOccurredAt: '2026-07-14T20:00:02.000Z',
        deviceId,
        entityId: 'a6300000-0000-4000-8000-000000000030',
        entityType: 'pain_report',
        operation: 'create',
        operationId: 'a6300000-0000-4000-8000-000000000031',
        payload: {
          bodyRegion: 'thigh',
          exerciseStopped: false,
          intensity: 'light',
          localDate: '2026-07-15',
          moment: 'next_day',
          type: 'muscular',
        },
      },
      {
        baseVersion: coffee.version,
        clientOccurredAt: '2026-07-14T20:00:03.000Z',
        deviceId,
        entityId: coffee.id,
        entityType: 'habit_definition',
        operation: 'update',
        operationId: 'a6300000-0000-4000-8000-000000000042',
        payload: {
          options: coffee.options.map((option: Record<string, unknown>, index: number) => ({
            ...option,
            label: index === 0 ? 'Não tomei' : option.label,
          })),
        },
      },
    ];
    const pushed = await request(users.first, 'POST', '/api/v1/sync/push', { operations });
    expect(pushed.statusCode).toBe(200);
    expect(pushed.json().results).toEqual(
      operations.map(() => expect.objectContaining({ status: 'applied' })),
    );
    expect(pushed.json().results.at(-1).record.options[0]).toMatchObject({
      id: coffee.options[0].id,
      label: 'Não tomei',
    });
    const pulled = await request(users.first, 'GET', '/api/v1/sync/pull?limit=100');
    expect(pulled.json().changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityType: 'workout_session' }),
        expect.objectContaining({ entityType: 'habit_definition' }),
        expect.objectContaining({ entityType: 'habit_entry' }),
        expect.objectContaining({ entityType: 'pain_report' }),
      ]),
    );
  });
});
