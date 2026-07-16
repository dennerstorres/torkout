import {
  exerciseSets,
  sessionExercises,
  trainingPlans,
  workoutSessions,
  workoutTemplateExercises,
  workoutTemplates,
  workoutTemplateSets,
  createDatabaseClient,
  migrateDatabase,
} from '@torkout/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from './app.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}
const { db, pool } = createDatabaseClient(connectionString);
const userId = '97000000-0000-4000-8000-000000000001';
let exerciseId = '';
const ids = {
  futureExercise: '97000000-0000-4000-8000-000000000010',
  futureSession: '97000000-0000-4000-8000-000000000011',
  futureSet: '97000000-0000-4000-8000-000000000012',
  plan: '97000000-0000-4000-8000-000000000013',
  template: '97000000-0000-4000-8000-000000000014',
  templateExercise: '97000000-0000-4000-8000-000000000015',
  templateSet: '97000000-0000-4000-8000-000000000016',
  thirdSession: '97000000-0000-4000-8000-000000000050',
  thirdExercise: '97000000-0000-4000-8000-000000000051',
  thirdSet: '97000000-0000-4000-8000-000000000052',
};
const fakeAuth = {
  api: {
    async deleteUser() {
      return { success: true };
    },
    async getSession(input: { headers: Headers }) {
      const id = input.headers.get('x-user-id');
      return id
        ? { session: { id: `session-${id}`, userId: id }, user: { emailVerified: true, id } }
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
const headers = { origin: 'https://torkout.example.test', 'x-user-id': userId };

describe('progression API', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
    await pool.query(
      "insert into users (id, name, email, email_verified) values ($1, 'Progressão', 'progression@example.invalid', true)",
      [userId],
    );
    const seeded = await pool.query<{ id: string }>(
      "select id from exercises where user_id = $1 and name = 'Flexão'",
      [userId],
    );
    exerciseId = seeded.rows[0]!.id;
    await db
      .insert(trainingPlans)
      .values({ id: ids.plan, name: 'Plano', status: 'active', userId, validFrom: '2026-07-01' });
    await db
      .insert(workoutTemplates)
      .values({ id: ids.template, name: 'Treino', planId: ids.plan, type: 'strength', userId });
    await db.insert(workoutTemplateExercises).values({
      exerciseId,
      id: ids.templateExercise,
      sortOrder: 0,
      templateId: ids.template,
      userId,
    });
    await db.insert(workoutTemplateSets).values({
      id: ids.templateSet,
      setNumber: 1,
      targetRepetitions: 10,
      templateExerciseId: ids.templateExercise,
      userId,
    });
    for (const [index, localDate] of ['2026-07-12', '2026-07-14'].entries()) {
      const sessionId = `97000000-0000-4000-8000-00000000002${index}`;
      const sessionExerciseId = `97000000-0000-4000-8000-00000000003${index}`;
      await db.insert(workoutSessions).values({
        completedAt: new Date(`${localDate}T22:00:00Z`),
        id: sessionId,
        jointPainStatus: 'none',
        plannedLocalDate: localDate,
        source: 'scheduled',
        startedAt: new Date(`${localDate}T21:00:00Z`),
        status: 'completed',
        templateId: ids.template,
        templateNameSnapshot: 'Treino',
        timeZone: 'America/Cuiaba',
        type: 'strength',
        userId,
      });
      await db.insert(sessionExercises).values({
        exerciseId,
        exerciseNameSnapshot: 'Flexão',
        id: sessionExerciseId,
        sessionId,
        sortOrder: 0,
        sourceTemplateExerciseId: ids.templateExercise,
        status: 'completed',
        trackingMetricSnapshot: 'repetitions',
        userId,
      });
      await db.insert(exerciseSets).values({
        actualRepetitions: 10,
        completed: true,
        id: `97000000-0000-4000-8000-00000000004${index}`,
        plannedRepetitions: 10,
        sessionExerciseId,
        setNumber: 1,
        userId,
      });
    }
    await db.insert(workoutSessions).values({
      id: ids.futureSession,
      plannedLocalDate: '2026-07-16',
      source: 'scheduled',
      status: 'planned',
      templateId: ids.template,
      templateNameSnapshot: 'Treino',
      timeZone: 'America/Cuiaba',
      type: 'strength',
      userId,
    });
    await db.insert(sessionExercises).values({
      exerciseId,
      exerciseNameSnapshot: 'Flexão',
      id: ids.futureExercise,
      sessionId: ids.futureSession,
      sortOrder: 0,
      sourceTemplateExerciseId: ids.templateExercise,
      trackingMetricSnapshot: 'repetitions',
      userId,
    });
    await db.insert(exerciseSets).values({
      id: ids.futureSet,
      plannedRepetitions: 10,
      sessionExerciseId: ids.futureExercise,
      setNumber: 1,
      userId,
    });
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('creates one versioned suggestion and accepts it idempotently for future targets only', async () => {
    const evaluate = await app.inject({
      headers,
      method: 'POST',
      payload: { sessionId: '97000000-0000-4000-8000-000000000021' },
      url: '/api/v1/progression/evaluate',
    });
    expect(evaluate.statusCode).toBe(202);
    await app.inject({
      headers,
      method: 'POST',
      payload: { sessionId: '97000000-0000-4000-8000-000000000021' },
      url: '/api/v1/progression/evaluate',
    });
    const list = await app.inject({
      headers,
      method: 'GET',
      url: '/api/v1/progression/suggestions?status=pending',
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);
    expect(list.json().items[0]).toMatchObject({ rule: { version: '1.0.0' }, type: 'increase' });
    const suggestionId = list.json().items[0].id as string;
    const first = await app.inject({
      headers,
      method: 'POST',
      payload: { decision: 'accepted' },
      url: `/api/v1/progression/suggestions/${suggestionId}/decisions`,
    });
    const repeated = await app.inject({
      headers,
      method: 'POST',
      payload: { decision: 'accepted' },
      url: `/api/v1/progression/suggestions/${suggestionId}/decisions`,
    });
    expect(first.json().id).toBe(repeated.json().id);
    const [future] = await db.select().from(exerciseSets).where(eq(exerciseSets.id, ids.futureSet));
    const [template] = await db
      .select()
      .from(workoutTemplateSets)
      .where(eq(workoutTemplateSets.id, ids.templateSet));
    expect(future?.plannedRepetitions).toBe(11);
    expect(template?.targetRepetitions).toBe(11);
  });

  it('invalidates a pending increase when a related joint-pain report arrives late', async () => {
    await db.insert(workoutSessions).values({
      completedAt: new Date('2026-07-15T22:00:00Z'),
      id: ids.thirdSession,
      jointPainStatus: 'none',
      plannedLocalDate: '2026-07-15',
      source: 'scheduled',
      startedAt: new Date('2026-07-15T21:00:00Z'),
      status: 'completed',
      templateId: ids.template,
      templateNameSnapshot: 'Treino',
      timeZone: 'America/Cuiaba',
      type: 'strength',
      userId,
    });
    await db.insert(sessionExercises).values({
      exerciseId,
      exerciseNameSnapshot: 'Flexão',
      id: ids.thirdExercise,
      sessionId: ids.thirdSession,
      sortOrder: 0,
      sourceTemplateExerciseId: ids.templateExercise,
      status: 'completed',
      trackingMetricSnapshot: 'repetitions',
      userId,
    });
    await db.insert(exerciseSets).values({
      actualRepetitions: 11,
      completed: true,
      id: ids.thirdSet,
      plannedRepetitions: 11,
      sessionExerciseId: ids.thirdExercise,
      setNumber: 1,
      userId,
    });
    await app.inject({
      headers,
      method: 'POST',
      payload: { sessionId: ids.thirdSession },
      url: '/api/v1/progression/evaluate',
    });
    const before = await app.inject({
      headers,
      method: 'GET',
      url: '/api/v1/progression/suggestions?status=pending',
    });
    expect(before.json().items).toHaveLength(1);
    expect(before.json().items[0].type).toBe('increase');
    const latePain = await app.inject({
      headers,
      method: 'POST',
      payload: {
        bodyRegion: 'wrist',
        exerciseId,
        exerciseStopped: false,
        id: '97000000-0000-4000-8000-000000000053',
        intensity: 'light',
        localDate: '2026-07-15',
        moment: 'after',
        sessionId: ids.thirdSession,
        type: 'joint',
      },
      url: '/api/v1/pain-reports',
    });
    expect(latePain.statusCode).toBe(201);
    const all = await app.inject({
      headers,
      method: 'GET',
      url: '/api/v1/progression/suggestions',
    });
    expect(all.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'invalidated', type: 'increase' }),
        expect.objectContaining({ status: 'pending', type: 'maintain' }),
      ]),
    );
  });
});
