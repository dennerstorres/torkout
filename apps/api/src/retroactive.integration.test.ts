import { createDatabaseClient, migrateDatabase } from '@torkout/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

const { db, pool } = createDatabaseClient(connectionString);
const timeZone = 'America/Cuiaba';
const users = {
  first: 'c1000000-0000-4000-8000-000000000001',
  second: 'c1000000-0000-4000-8000-000000000002',
};
const ids = {
  pastSession: 'c1100000-0000-4000-8000-000000000001',
  pastExercise: 'c1100000-0000-4000-8000-000000000002',
  pastFirstSet: 'c1100000-0000-4000-8000-000000000003',
  pastExtraSet: 'c1100000-0000-4000-8000-000000000004',
  todaySession: 'c1200000-0000-4000-8000-000000000001',
  todayExercise: 'c1200000-0000-4000-8000-000000000002',
  todaySet: 'c1200000-0000-4000-8000-000000000003',
  futureSession: 'c1300000-0000-4000-8000-000000000001',
  futureExercise: 'c1300000-0000-4000-8000-000000000002',
  futureSet: 'c1300000-0000-4000-8000-000000000003',
};
let pushUpId = '';

function localDateIn(zone: string, offsetDays: number): string {
  const base = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(base);
}

const pastDate = localDateIn(timeZone, -3);

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

async function createSession(
  sessionId: string,
  exerciseId: string,
  setId: string,
  plannedLocalDate: string,
) {
  return request(users.first, 'POST', '/api/v1/sessions', {
    exercises: [
      {
        exerciseId: pushUpId,
        id: exerciseId,
        name: 'Flexão',
        sets: [{ id: setId, setNumber: 1, targetRepetitions: 8 }],
        sortOrder: 0,
        trackingMetric: 'repetitions',
      },
    ],
    id: sessionId,
    plannedLocalDate,
    source: 'ad_hoc',
    templateNameSnapshot: 'Treino',
    timeZone,
    type: 'strength',
  });
}

describe('lançamento retroativo de treino', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
    await pool.query(
      `insert into users (id, name, email, email_verified) values
       ($1, 'Primeira', 'retro-first@example.invalid', true),
       ($2, 'Segunda', 'retro-second@example.invalid', true)`,
      [users.first, users.second],
    );
    const seeded = await pool.query<{ id: string }>(
      "select id from exercises where user_id = $1 and name = 'Flexão'",
      [users.first],
    );
    pushUpId = seeded.rows[0]!.id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('marca a sessão lançada depois da data e aceita série além do planejado', async () => {
    const created = await createSession(
      ids.pastSession,
      ids.pastExercise,
      ids.pastFirstSet,
      pastDate,
    );
    expect(created.statusCode).toBe(201);
    expect(created.json().retroactivelyLoggedAt).toBeNull();

    const logged = await request(
      users.first,
      'PUT',
      `/api/v1/sessions/${ids.pastSession}/execution`,
      {
        execution: {
          exercises: [
            {
              id: ids.pastExercise,
              sets: [
                { actualRepetitions: 12, completed: true, id: ids.pastFirstSet, setNumber: 1 },
                { actualRepetitions: 12, completed: true, id: ids.pastExtraSet, setNumber: 2 },
              ],
              status: 'completed',
            },
          ],
        },
        version: created.json().version,
      },
    );
    expect(logged.statusCode).toBe(200);
    expect(logged.json().status).toBe('completed');
    expect(typeof logged.json().retroactivelyLoggedAt).toBe('string');
    // A série extra não estava planejada: o alvo permanece nulo.
    const extra = logged
      .json()
      .exercises[0].sets.find((set: { id: string }) => set.id === ids.pastExtraSet);
    expect(extra).toMatchObject({ actualRepetitions: 12, plannedRepetitions: null });
  });

  it('preserva a marca original quando a sessão é corrigida de novo', async () => {
    const listed = await request(
      users.first,
      'GET',
      `/api/v1/sessions?from=${pastDate}&through=${pastDate}`,
    );
    expect(listed.statusCode).toBe(200);
    const current = listed.json().items.find((item: { id: string }) => item.id === ids.pastSession);
    const firstMark = current.retroactivelyLoggedAt;
    expect(typeof firstMark).toBe('string');

    const corrected = await request(
      users.first,
      'PUT',
      `/api/v1/sessions/${ids.pastSession}/execution`,
      {
        execution: {
          exercises: [
            {
              id: ids.pastExercise,
              sets: [
                { actualRepetitions: 10, completed: true, id: ids.pastFirstSet, setNumber: 1 },
              ],
              status: 'completed',
            },
          ],
        },
        version: current.version,
      },
    );
    expect(corrected.statusCode).toBe(200);
    expect(corrected.json().retroactivelyLoggedAt).toBe(firstMark);
  });

  it('registro feito na própria data não recebe marca de retroativo', async () => {
    const created = await createSession(
      ids.todaySession,
      ids.todayExercise,
      ids.todaySet,
      localDateIn(timeZone, 0),
    );
    expect(created.statusCode).toBe(201);

    const logged = await request(
      users.first,
      'PUT',
      `/api/v1/sessions/${ids.todaySession}/execution`,
      {
        execution: {
          exercises: [
            {
              id: ids.todayExercise,
              sets: [{ actualRepetitions: 8, completed: true, id: ids.todaySet, setNumber: 1 }],
              status: 'completed',
            },
          ],
        },
        version: created.json().version,
      },
    );
    expect(logged.statusCode).toBe(200);
    expect(logged.json().retroactivelyLoggedAt).toBeNull();
  });

  it('recusa lançar execução em sessão de data futura com erro próprio', async () => {
    const created = await createSession(
      ids.futureSession,
      ids.futureExercise,
      ids.futureSet,
      localDateIn(timeZone, 3),
    );
    expect(created.statusCode).toBe(201);

    const logged = await request(
      users.first,
      'PUT',
      `/api/v1/sessions/${ids.futureSession}/execution`,
      {
        execution: {
          exercises: [
            {
              id: ids.futureExercise,
              sets: [{ actualRepetitions: 8, completed: true, id: ids.futureSet, setNumber: 1 }],
              status: 'completed',
            },
          ],
        },
        version: created.json().version,
      },
    );
    expect(logged.statusCode).toBe(422);
    expect(logged.json().code).toBe('SESSION_DATE_IN_FUTURE');
  });

  it('não permite lançar na sessão de outro usuário', async () => {
    const foreign = await request(
      users.second,
      'PUT',
      `/api/v1/sessions/${ids.pastSession}/execution`,
      {
        execution: { exercises: [] },
        version: 1,
      },
    );
    expect(foreign.statusCode).toBe(404);
  });
});
