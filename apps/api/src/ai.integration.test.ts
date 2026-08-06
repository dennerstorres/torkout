import { MCP_SCOPE } from '@torkout/contracts';
import {
  bodyMeasurements,
  coffeeIntakes,
  createDatabaseClient,
  exerciseSets,
  mcpTokens,
  migrateDatabase,
  painReports,
  sessionExercises,
  userProfiles,
  users,
  wheyIntakes,
  workoutSessions,
} from '@torkout/database';
import { instantToLocalDate } from '@torkout/domain';
import { createHash, randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import type { ApiDependencies, AuthRuntime, SessionData } from './auth-routes.js';
import { AI_ENDPOINTS } from './ai/routes.js';
import { hashCredential } from './mcp/oauth.js';

/**
 * Camada REST de `/api/ai`, exercitada de ponta a ponta contra PostgreSQL real.
 *
 * A suíte cobre o porteiro (ausência de credencial, token inválido, escopo insuficiente), o
 * isolamento entre contas, o contrato de cada endpoint, as distinções semânticas que o modelo não
 * pode confundir e a superfície somente leitura.
 */

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

const { db, pool } = createDatabaseClient(connectionString);
const origin = 'https://torkout.example.test';
const timeZone = 'America/Cuiaba';

let currentSession: SessionData | null = null;

const auth: AuthRuntime = {
  api: {
    deleteUser: async () => ({}),
    getSession: async () => currentSession,
    verifyPassword: async () => ({}),
  },
  handler: async () => new Response(null, { status: 404 }),
};

const dependencies: ApiDependencies = { auth, database: db, trustedOrigins: [origin] };

// A suíte percorre o fluxo dezenas de vezes; o limitador tem cobertura própria em
// `mcp/rate-limit.test.ts` e um caso dedicado no fim deste arquivo.
const app = buildApp(dependencies, {
  mcp: {
    publicUrl: origin,
    rateLimits: { callsPerMinute: 10_000, registrationsPerHour: 10_000, tokensPerMinute: 10_000 },
  },
});

const ownerId = '33333333-3333-4333-8333-333333333333';
const otherId = '44444444-4444-4444-8444-444444444444';
const ownerSessionId = '33333333-3333-4333-8333-3333333333a1';
const futureSessionId = '33333333-3333-4333-8333-3333333333a2';
const ownerExerciseId = '33333333-3333-4333-8333-3333333333b1';

/** Datas civis ancoradas em "hoje" no fuso do titular, para não depender do dia da execução. */
const today = instantToLocalDate(new Date().toISOString(), timeZone);
function shift(days: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
const window = { from: shift(-7), to: shift(7) };

function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  return { challenge: createHash('sha256').update(verifier).digest('base64url'), verifier };
}

function sessionFor(userId: string): SessionData {
  return {
    session: { id: `session-${userId}`, userId },
    user: { emailVerified: true, id: userId },
  };
}

async function seedUser(id: string, email: string, name: string): Promise<void> {
  await db.insert(users).values({ email, emailVerified: true, id, name }).onConflictDoNothing();
  await db.insert(userProfiles).values({ timeZone, userId: id }).onConflictDoNothing();
}

async function registerClient(redirectUri = 'https://chat.openai.com/aip/callback') {
  const response = await app.inject({
    method: 'POST',
    payload: { client_name: 'GPT de teste', redirect_uris: [redirectUri] },
    url: '/oauth/register',
  });
  expect(response.statusCode).toBe(201);
  return response.json() as { client_id: string };
}

async function authorizeAs(userId: string, clientId: string) {
  const { challenge, verifier } = pkce();
  currentSession = sessionFor(userId);
  const consent = await app.inject({
    headers: { origin },
    method: 'POST',
    payload: {
      client_id: clientId,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      decision: 'allow',
      redirect_uri: 'https://chat.openai.com/aip/callback',
      scope: MCP_SCOPE,
    },
    url: '/oauth/authorize',
  });
  currentSession = null;
  const code = new URL(consent.headers.location as string).searchParams.get('code');

  const token = await app.inject({
    method: 'POST',
    payload: {
      client_id: clientId,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: 'https://chat.openai.com/aip/callback',
    },
    url: '/oauth/token',
  });
  expect(token.statusCode).toBe(200);
  return token.json() as { access_token: string; refresh_token: string };
}

/** Token do titular, criado uma vez e reaproveitado pelos casos de leitura. */
let ownerToken = '';

function get(path: string, accessToken: string | null = ownerToken) {
  return app.inject({
    ...(accessToken ? { headers: { authorization: `Bearer ${accessToken}` } } : {}),
    method: 'GET',
    url: `/api/ai${path}`,
  });
}

beforeAll(async () => {
  await migrateDatabase(db);
  await db.execute(sql`delete from mcp_tokens`);
  await db.execute(sql`delete from mcp_authorization_codes`);
  await db.execute(sql`delete from mcp_consents`);
  await db.execute(sql`delete from mcp_oauth_clients`);
  await db.delete(users).where(eq(users.id, ownerId));
  await db.delete(users).where(eq(users.id, otherId));
  await seedUser(ownerId, 'ai-owner@example.test', 'Titular');
  await seedUser(otherId, 'ai-other@example.test', 'Outra pessoa');

  await db.insert(workoutSessions).values([
    {
      id: ownerSessionId,
      perceivedExertion: 6,
      plannedLocalDate: shift(-2),
      // Respondeu explicitamente que sentiu desconforto; distinto de não ter respondido.
      recoveryStatus: 'reported',
      source: 'scheduled',
      status: 'completed',
      templateNameSnapshot: 'Treino do titular',
      timeZone,
      type: 'strength',
      userId: ownerId,
    },
    {
      // Sessão ainda por acontecer: nunca pode entrar como falta.
      id: futureSessionId,
      plannedLocalDate: shift(3),
      source: 'scheduled',
      status: 'planned',
      templateNameSnapshot: 'Treino futuro do titular',
      timeZone,
      type: 'strength',
      userId: ownerId,
    },
    {
      plannedLocalDate: shift(-2),
      source: 'scheduled',
      status: 'completed',
      templateNameSnapshot: 'Treino da outra pessoa',
      timeZone,
      type: 'strength',
      userId: otherId,
    },
  ]);

  await db.insert(sessionExercises).values({
    exerciseNameSnapshot: 'Flexão',
    id: ownerExerciseId,
    sessionId: ownerSessionId,
    sortOrder: 0,
    status: 'completed',
    trackingMetricSnapshot: 'repetitions',
    userId: ownerId,
  });
  await db.insert(exerciseSets).values([
    {
      actualRepetitions: 12,
      completed: true,
      plannedRepetitions: 10,
      sessionExerciseId: ownerExerciseId,
      setNumber: 1,
      userId: ownerId,
    },
    {
      actualRepetitions: 14,
      completed: true,
      plannedRepetitions: 10,
      sessionExerciseId: ownerExerciseId,
      setNumber: 2,
      userId: ownerId,
    },
  ]);

  await db.insert(bodyMeasurements).values({
    // Cintura e barriga são medidas distintas e propositalmente diferentes aqui.
    abdomenCm: '95.50',
    localDate: shift(-2),
    measuredAt: new Date(`${shift(-2)}T09:00:00Z`),
    userId: ownerId,
    waistCm: '88.20',
    weightKg: '82.40',
  });

  await db.insert(coffeeIntakes).values([
    { localDate: shift(-2), status: 'without_sugar', userId: ownerId },
    { localDate: shift(-1), status: 'not_consumed', userId: ownerId },
  ]);
  await db.insert(wheyIntakes).values({
    consumed: true,
    localDate: shift(-2),
    powderGrams: '30.00',
    userId: ownerId,
  });
  await db.insert(painReports).values({
    bodyRegion: 'knee',
    intensity: 'light',
    intensityScore: 3,
    localDate: shift(-2),
    moment: 'during',
    sessionId: ownerSessionId,
    type: 'joint',
    userId: ownerId,
  });

  await app.ready();
  const client = await registerClient();
  ownerToken = (await authorizeAs(ownerId, client.client_id)).access_token;
});

afterAll(async () => {
  await app.close();
  await db.execute(sql`delete from mcp_tokens`);
  await db.execute(sql`delete from mcp_authorization_codes`);
  await db.execute(sql`delete from mcp_consents`);
  await db.execute(sql`delete from mcp_oauth_clients`);
  await db.delete(users).where(eq(users.id, ownerId));
  await db.delete(users).where(eq(users.id, otherId));
  await pool.end();
});

describe('autenticação', () => {
  it('recusa uma chamada sem Authorization e aponta os metadados', async () => {
    const response = await get('/profile', null);
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'unauthorized' });
    expect(response.headers['www-authenticate']).toContain('resource_metadata=');
  });

  it('recusa um token desconhecido', async () => {
    const response = await get('/profile', randomBytes(32).toString('base64url'));
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'invalid_token' });
  });

  it('recusa um token expirado', async () => {
    const client = await registerClient();
    const tokens = await authorizeAs(ownerId, client.client_id);
    await db
      .update(mcpTokens)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(mcpTokens.tokenHash, hashCredential(tokens.access_token)));

    expect((await get('/profile', tokens.access_token)).statusCode).toBe(401);
  });

  it('recusa um token com escopo diferente de leitura', async () => {
    const client = await registerClient();
    const foreign = randomBytes(32).toString('base64url');
    await db.insert(mcpTokens).values({
      clientId: client.client_id,
      expiresAt: new Date(Date.now() + 60_000),
      kind: 'access',
      scope: 'torkout:write',
      tokenHash: hashCredential(foreign),
      userId: ownerId,
    });

    const response = await get('/profile', foreign);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'insufficient_scope' });
  });

  it('exige credencial em todos os endpoints, sem exceção', async () => {
    for (const endpoint of AI_ENDPOINTS) {
      expect((await get(endpoint.path, null)).statusCode).toBe(401);
    }
  });

  it('responde ao health check sem expor configuração', async () => {
    const response = await get('/health', null);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ scope: MCP_SCOPE, status: 'ok' });
  });
});

describe('isolamento entre contas', () => {
  it('devolve a cada titular apenas os próprios treinos', async () => {
    const client = await registerClient();
    const otherToken = (await authorizeAs(otherId, client.client_id)).access_token;
    const query = `/workouts?from=${window.from}&to=${window.to}`;

    const ownerBody = (await get(query)).body;
    const otherBody = (await get(query, otherToken)).body;

    expect(ownerBody).toContain('Treino do titular');
    expect(ownerBody).not.toContain('Treino da outra pessoa');
    expect(otherBody).toContain('Treino da outra pessoa');
    expect(otherBody).not.toContain('Treino do titular');
  });

  it('ignora userId e email na consulta e continua no dono do token', async () => {
    const response = await get(
      `/workouts?from=${window.from}&to=${window.to}&userId=${otherId}&email=ai-other@example.test`,
    );
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Treino do titular');
    expect(response.body).not.toContain('Treino da outra pessoa');
    expect(response.body).not.toContain(otherId);
  });
});

describe('endpoints', () => {
  it('devolve o perfil do dono do token, sem credencial', async () => {
    const response = await get('/profile');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    const payload = response.json() as { time_zone: string };
    expect(payload.time_zone).toBe(timeZone);
    expect(response.body).not.toContain('ai-owner@example.test');
  });

  it('resume o treino sem contar a sessão futura como falta', async () => {
    const response = await get(`/training-summary?from=${window.from}&to=${window.to}`);
    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      requested_period: { days: number; from: string; time_zone: string; to: string };
      strength: { completed: number; future_not_counted: number; missed: number };
    };
    expect(payload.requested_period).toEqual({
      days: 15,
      from: window.from,
      time_zone: timeZone,
      to: window.to,
    });
    expect(payload.strength.completed).toBe(1);
    expect(payload.strength.future_not_counted).toBe(1);
    expect(payload.strength.missed).toBe(0);
  });

  it('lista os treinos do período com exercícios e séries', async () => {
    const payload = (
      await get(`/workouts?from=${window.from}&to=${window.to}&exercise=flexao`)
    ).json() as { workouts: Array<{ exercises: Array<{ name: string }> }> };
    expect(payload.workouts.length).toBeGreaterThan(0);
    expect(payload.workouts[0]?.exercises[0]?.name).toBe('Flexão');
  });

  it('devolve o último treino concluído', async () => {
    const payload = (await get('/last-workout')).json() as { workout: { date: string } | null };
    expect(payload.workout?.date).toBe(shift(-2));
  });

  it('devolve a progressão de um exercício', async () => {
    const payload = (
      await get(`/exercise-progress?exercise=flexao&from=${window.from}&to=${window.to}`)
    ).json() as { best_set: number | null; total_volume: number };
    expect(payload.best_set).toBe(14);
    expect(payload.total_volume).toBe(26);
  });

  it('exige o exercício em exercise-progress', async () => {
    const response = await get('/exercise-progress');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_parameter' });
  });

  it('mantém cintura e barriga como medidas distintas', async () => {
    const payload = (await get(`/measurements?from=${window.from}&to=${window.to}`)).json() as {
      measurements: Array<{ abdomen_cm: number | null; waist_cm: number | null }>;
    };
    expect(payload.measurements[0]?.waist_cm).toBe(88.2);
    expect(payload.measurements[0]?.abdomen_cm).toBe(95.5);
    expect(payload.measurements[0]?.waist_cm).not.toBe(payload.measurements[0]?.abdomen_cm);
  });

  it('resume as medidas separando cada métrica', async () => {
    const payload = (
      await get(`/measurement-summary?from=${window.from}&to=${window.to}`)
    ).json() as Record<string, { last: number } | null>;
    expect(payload.waist_cm?.last).toBe(88.2);
    expect(payload.abdomen_cm?.last).toBe(95.5);
    // Sem registro de quadril, o resumo devolve nulo em vez de zero.
    expect(payload.hip_cm).toBeNull();
  });

  it('devolve caminhadas mesmo quando não houve nenhuma', async () => {
    const response = await get(`/walks?from=${window.from}&to=${window.to}`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ period: { from: window.from } });
  });

  it('nunca soma café sem açúcar a café não consumido', async () => {
    const payload = (await get(`/nutrition?from=${window.from}&to=${window.to}`)).json() as {
      coffee: { days_without_record: number; not_consumed: number; without_sugar: number };
      macronutrients: null;
    };
    expect(payload.coffee.without_sugar).toBe(1);
    expect(payload.coffee.not_consumed).toBe(1);
    expect(payload.coffee.days_without_record).toBe(13);
    expect(payload.macronutrients).toBeNull();
  });

  it('devolve o histórico de whey', async () => {
    const payload = (await get(`/whey-history?from=${window.from}&to=${window.to}`)).json() as {
      returned: number;
    };
    expect(payload.returned).toBe(1);
  });

  it('separa ausência de resposta de resposta sem dor', async () => {
    const payload = (await get(`/recovery?from=${window.from}&to=${window.to}`)).json() as {
      answers: {
        explicitly_without_pain: number;
        not_answered: number;
        reported_discomfort: number;
      };
      counts: { joint: number };
      notice: string;
    };
    expect(payload.answers.reported_discomfort).toBe(1);
    expect(payload.answers.explicitly_without_pain).toBe(0);
    // A sessão futura existe e não respondeu nada: ausência de registro, nunca "sem dor".
    expect(payload.answers.not_answered).toBe(1);
    expect(payload.counts.joint).toBe(1);
    expect(payload.notice).toContain('Ausência de registro');
  });

  it('devolve o progresso consolidado', async () => {
    const response = await get(`/progress?from=${window.from}&to=${window.to}`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ period: { time_zone: timeZone } });
  });

  it('devolve as mudanças recentes com janela padrão de catorze dias', async () => {
    const payload = (await get('/recent-changes')).json() as { period: { days: number } };
    expect(payload.period.days).toBe(14);
  });

  it('compara dois períodos explícitos', async () => {
    const response = await get(
      `/compare-periods?current_from=${shift(-6)}&current_to=${today}` +
        `&previous_from=${shift(-13)}&previous_to=${shift(-7)}`,
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      periods: { current: { from: shift(-6) }, previous: { from: shift(-13) } },
    });
  });

  it('exige os quatro limites em compare-periods', async () => {
    const response = await get(`/compare-periods?current_from=${today}`);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_parameter' });
  });
});

describe('validação', () => {
  it('recusa um período invertido sem vazar detalhe interno', async () => {
    const response = await get('/training-summary?from=2026-08-06&to=2026-07-01');
    expect(response.statusCode).toBe(400);
    const body = response.body;
    expect(JSON.parse(body)).toMatchObject({ error: 'invalid_parameter' });
    expect(body).not.toMatch(/select |from "workout_sessions"|node_modules|\.ts:\d+|C:\\/i);
  });

  it('recusa `days` junto de `from` e `to`', async () => {
    const response = await get(`/training-summary?days=7&from=${window.from}&to=${window.to}`);
    expect(response.statusCode).toBe(400);
  });

  it('recusa uma data civil inexistente', async () => {
    const response = await get('/training-summary?from=2026-02-30&to=2026-03-05');
    expect(response.statusCode).toBe(400);
  });

  it('recusa `days` não inteiro', async () => {
    expect((await get('/training-summary?days=sete')).statusCode).toBe(400);
    expect((await get('/training-summary?days=1.5')).statusCode).toBe(400);
  });

  it('recusa um limite acima do teto', async () => {
    const response = await get('/measurements?days=7&limit=5000');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_parameter' });
  });

  it('orienta a usar o resumo em vez de despejar um período longo', async () => {
    const response = await get('/workouts?days=400');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'period_too_long' });
  });

  it('recusa um período acima da janela máxima', async () => {
    const response = await get('/training-summary?days=900');
    expect(response.statusCode).toBe(400);
  });
});

describe('superfície somente leitura', () => {
  it('não expõe nenhum verbo de escrita', async () => {
    for (const endpoint of AI_ENDPOINTS) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
        const response = await app.inject({
          headers: { authorization: `Bearer ${ownerToken}` },
          method,
          url: `/api/ai${endpoint.path}`,
        });
        expect(response.statusCode).toBe(404);
      }
    }
  });

  it('nenhuma resposta devolve material de credencial', async () => {
    for (const endpoint of AI_ENDPOINTS) {
      if (endpoint.path === '/compare-periods' || endpoint.path === '/exercise-progress') continue;
      const body = (await get(`${endpoint.path}?days=30`)).body;
      expect(body).not.toContain(ownerToken);
      expect(body).not.toMatch(/"(password|passwordHash|clientSecret|tokenHash|sessionToken)"/);
    }
  });
});

describe('equivalência com o MCP', () => {
  it('devolve para a mesma pergunta o mesmo objeto da ferramenta MCP', async () => {
    const rest = (await get(`/training-summary?from=${window.from}&to=${window.to}`)).json();

    const mcp = await app.inject({
      headers: {
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
      payload: {
        id: 1,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          arguments: { from: window.from, to: window.to },
          name: 'get_training_summary',
        },
      },
      url: '/mcp',
    });
    const text = (JSON.parse(mcp.body) as { result: { content: Array<{ text: string }> } }).result
      .content[0]?.text;

    expect(rest).toEqual(JSON.parse(text ?? '{}'));
  });
});

describe('limitação de chamadas', () => {
  it('divide o mesmo contador com o transporte MCP', async () => {
    const limited = buildApp(dependencies, {
      mcp: { publicUrl: origin, rateLimits: { callsPerMinute: 1 } },
    });
    await limited.ready();
    const headers = { authorization: `Bearer ${ownerToken}` };

    const first = await limited.inject({ headers, method: 'GET', url: '/api/ai/profile' });
    expect(first.statusCode).toBe(200);

    // A segunda chamada já estoura o teto, e o transporte MCP sente o mesmo contador.
    const blocked = await limited.inject({
      headers: { ...headers, 'content-type': 'application/json' },
      method: 'POST',
      payload: { id: 1, jsonrpc: '2.0', method: 'tools/list', params: {} },
      url: '/mcp',
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    await limited.close();
  });
});
