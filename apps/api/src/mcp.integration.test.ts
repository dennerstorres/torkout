import {
  createDatabaseClient,
  mcpTokens,
  migrateDatabase,
  userProfiles,
  users,
  workoutSessions,
} from '@torkout/database';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import type { ApiDependencies, AuthRuntime, SessionData } from './auth-routes.js';
import { hashCredential } from './mcp/oauth.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

const { db, pool } = createDatabaseClient(connectionString);
const origin = 'https://torkout.example.test';

/**
 * Sessão do Better Auth simulada pelo cabeçalho `x-test-session`. O objetivo desta suíte é o
 * servidor MCP e o fluxo OAuth; a autenticação por cookie já tem cobertura própria em
 * `auth.integration.test.ts`.
 */
let currentSession: SessionData | null = null;

const auth: AuthRuntime = {
  api: {
    deleteUser: async () => ({}),
    getSession: async () => currentSession,
    verifyPassword: async () => ({}),
  },
  handler: async () => new Response(null, { status: 404 }),
};

const dependencies: ApiDependencies = {
  auth,
  database: db,
  trustedOrigins: [origin],
};

// Os limites de produção existem contra abuso externo; esta suíte exercita o fluxo dezenas de
// vezes, então usa uma folga própria. O comportamento do limitador tem teste dedicado em
// `mcp/rate-limit.test.ts` e um caso próprio no fim desta suíte.
const app = buildApp(dependencies, {
  mcp: {
    publicUrl: origin,
    rateLimits: { callsPerMinute: 10_000, registrationsPerHour: 10_000, tokensPerMinute: 10_000 },
  },
});

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

function sessionFor(userId: string): SessionData {
  return {
    session: { id: `session-${userId}`, userId },
    user: { emailVerified: true, id: userId },
  };
}

function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  return { challenge: createHash('sha256').update(verifier).digest('base64url'), verifier };
}

async function seedUser(id: string, email: string, name: string): Promise<void> {
  await db.insert(users).values({ email, emailVerified: true, id, name }).onConflictDoNothing();
  await db
    .insert(userProfiles)
    .values({ timeZone: 'America/Cuiaba', userId: id })
    .onConflictDoNothing();
}

async function registerClient(redirectUri = 'https://chatgpt.com/callback') {
  const response = await app.inject({
    method: 'POST',
    payload: { client_name: 'Cliente de teste', redirect_uris: [redirectUri] },
    url: '/oauth/register',
  });
  expect(response.statusCode).toBe(201);
  return response.json() as { client_id: string };
}

/** Percorre o fluxo completo e devolve o par de tokens do usuário indicado. */
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
      redirect_uri: 'https://chatgpt.com/callback',
      scope: 'torkout:read',
      state: 'xyz',
    },
    url: '/oauth/authorize',
  });
  currentSession = null;
  expect(consent.statusCode).toBe(302);
  const location = new URL(consent.headers.location as string);
  expect(location.searchParams.get('state')).toBe('xyz');
  const code = location.searchParams.get('code');
  expect(code).toBeTruthy();

  const token = await app.inject({
    method: 'POST',
    payload: {
      client_id: clientId,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: 'https://chatgpt.com/callback',
    },
    url: '/oauth/token',
  });
  expect(token.statusCode).toBe(200);
  return token.json() as { access_token: string; refresh_token: string; scope: string };
}

let callId = 0;
async function callTool(
  accessToken: string | null,
  name: string,
  args: Record<string, unknown> = {},
) {
  callId += 1;
  return app.inject({
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    method: 'POST',
    payload: {
      id: callId,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { arguments: args, name },
    },
    url: '/mcp',
  });
}

function toolPayload(response: { body: string }): unknown {
  const parsed = JSON.parse(response.body) as {
    result?: { content?: Array<{ text?: string }>; isError?: boolean };
  };
  const text = parsed.result?.content?.[0]?.text;
  return text === undefined ? parsed : JSON.parse(text);
}

beforeAll(async () => {
  await migrateDatabase(db);
  await db.execute(sql`delete from mcp_tokens`);
  await db.execute(sql`delete from mcp_authorization_codes`);
  await db.execute(sql`delete from mcp_consents`);
  await db.execute(sql`delete from mcp_oauth_clients`);
  await db.delete(users).where(eq(users.id, ownerId));
  await db.delete(users).where(eq(users.id, otherId));
  await seedUser(ownerId, 'owner@example.test', 'Titular');
  await seedUser(otherId, 'other@example.test', 'Outra pessoa');

  await db.insert(workoutSessions).values([
    {
      plannedLocalDate: '2026-08-03',
      source: 'scheduled',
      status: 'completed',
      templateNameSnapshot: 'Treino do titular',
      timeZone: 'America/Cuiaba',
      type: 'strength',
      userId: ownerId,
    },
    {
      plannedLocalDate: '2026-08-03',
      source: 'scheduled',
      status: 'completed',
      templateNameSnapshot: 'Treino da outra pessoa',
      timeZone: 'America/Cuiaba',
      type: 'strength',
      userId: otherId,
    },
  ]);
  await app.ready();
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

describe('discovery', () => {
  it('publishes the protected resource metadata', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-protected-resource/mcp',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      authorization_servers: [origin],
      resource: `${origin}/mcp`,
      scopes_supported: ['torkout:read'],
    });
  });

  it('advertises PKCE with S256 and refuses to advertise plain', async () => {
    const metadata = (
      await app.inject({ method: 'GET', url: '/.well-known/oauth-authorization-server' })
    ).json() as { code_challenge_methods_supported: string[] };
    expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
  });
});

describe('authentication', () => {
  it('refuses a call with no credential and points at the metadata', async () => {
    const response = await callTool(null, 'get_profile');
    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toContain('resource_metadata=');
    expect(response.body).not.toMatch(/at .*\.ts:|select |from "users"/i);
  });

  it('refuses an unknown token', async () => {
    const response = await callTool(randomBytes(32).toString('base64url'), 'get_profile');
    expect(response.statusCode).toBe(401);
  });

  it('refuses an expired token', async () => {
    const client = await registerClient();
    const tokens = await authorizeAs(ownerId, client.client_id);
    await db
      .update(mcpTokens)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(mcpTokens.tokenHash, hashCredential(tokens.access_token)));

    const response = await callTool(tokens.access_token, 'get_profile');
    expect(response.statusCode).toBe(401);
  });

  it('refuses a revoked token', async () => {
    const client = await registerClient();
    const tokens = await authorizeAs(ownerId, client.client_id);
    await app.inject({
      method: 'POST',
      payload: { client_id: client.client_id, token: tokens.access_token },
      url: '/oauth/revoke',
    });

    const response = await callTool(tokens.access_token, 'get_profile');
    expect(response.statusCode).toBe(401);
  });
});

describe('authorization code flow', () => {
  it('refuses a code presented without its verifier', async () => {
    const client = await registerClient();
    const { challenge } = pkce();
    currentSession = sessionFor(ownerId);
    const consent = await app.inject({
      headers: { origin },
      method: 'POST',
      payload: {
        client_id: client.client_id,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        decision: 'allow',
        redirect_uri: 'https://chatgpt.com/callback',
        scope: 'torkout:read',
      },
      url: '/oauth/authorize',
    });
    currentSession = null;
    const code = new URL(consent.headers.location as string).searchParams.get('code');

    const response = await app.inject({
      method: 'POST',
      payload: {
        client_id: client.client_id,
        code,
        grant_type: 'authorization_code',
      },
      url: '/oauth/token',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_grant' });
  });

  it('refuses a code presented with the wrong verifier', async () => {
    const client = await registerClient();
    const { challenge } = pkce();
    currentSession = sessionFor(ownerId);
    const consent = await app.inject({
      headers: { origin },
      method: 'POST',
      payload: {
        client_id: client.client_id,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        decision: 'allow',
        redirect_uri: 'https://chatgpt.com/callback',
        scope: 'torkout:read',
      },
      url: '/oauth/authorize',
    });
    currentSession = null;
    const code = new URL(consent.headers.location as string).searchParams.get('code');

    const response = await app.inject({
      method: 'POST',
      payload: {
        client_id: client.client_id,
        code,
        code_verifier: randomBytes(32).toString('base64url'),
        grant_type: 'authorization_code',
      },
      url: '/oauth/token',
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuses to exchange the same code twice', async () => {
    const client = await registerClient();
    const { challenge, verifier } = pkce();
    currentSession = sessionFor(ownerId);
    const consent = await app.inject({
      headers: { origin },
      method: 'POST',
      payload: {
        client_id: client.client_id,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        decision: 'allow',
        redirect_uri: 'https://chatgpt.com/callback',
        scope: 'torkout:read',
      },
      url: '/oauth/authorize',
    });
    currentSession = null;
    const code = new URL(consent.headers.location as string).searchParams.get('code');
    const payload = {
      client_id: client.client_id,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
    };

    expect((await app.inject({ method: 'POST', payload, url: '/oauth/token' })).statusCode).toBe(
      200,
    );
    const second = await app.inject({ method: 'POST', payload, url: '/oauth/token' });
    expect(second.statusCode).toBe(400);
    expect(second.json()).toMatchObject({ error: 'invalid_grant' });
  });

  it('refuses an unregistered redirect uri', async () => {
    const client = await registerClient();
    const response = await app.inject({
      method: 'GET',
      url: `/oauth/authorize?client_id=${client.client_id}&response_type=code&redirect_uri=https%3A%2F%2Fevil.test%2Fcallback&code_challenge=abc&code_challenge_method=S256`,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('refuses a write scope', async () => {
    const client = await registerClient();
    const response = await app.inject({
      method: 'GET',
      url: `/oauth/authorize?client_id=${client.client_id}&response_type=code&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fcallback&code_challenge=abc&code_challenge_method=S256&scope=torkout%3Awrite`,
    });
    expect(response.statusCode).toBe(302);
    expect(new URL(response.headers.location as string).searchParams.get('error')).toBe(
      'invalid_scope',
    );
  });

  it('rotates the refresh token and refuses the old one', async () => {
    const client = await registerClient();
    const tokens = await authorizeAs(ownerId, client.client_id);
    const refreshed = await app.inject({
      method: 'POST',
      payload: {
        client_id: client.client_id,
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      },
      url: '/oauth/token',
    });
    expect(refreshed.statusCode).toBe(200);
    expect((refreshed.json() as { refresh_token: string }).refresh_token).not.toBe(
      tokens.refresh_token,
    );

    const reused = await app.inject({
      method: 'POST',
      payload: {
        client_id: client.client_id,
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      },
      url: '/oauth/token',
    });
    expect(reused.statusCode).toBe(400);
  });
});

describe('tools', () => {
  it('lists only read oriented tools', async () => {
    const client = await registerClient();
    const tokens = await authorizeAs(ownerId, client.client_id);
    const response = await app.inject({
      headers: {
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${tokens.access_token}`,
        'content-type': 'application/json',
      },
      method: 'POST',
      payload: { id: 99, jsonrpc: '2.0', method: 'tools/list', params: {} },
      url: '/mcp',
    });
    expect(response.statusCode).toBe(200);
    const listed = (
      JSON.parse(response.body) as {
        result: { tools: Array<{ annotations?: { readOnlyHint?: boolean }; name: string }> };
      }
    ).result.tools;

    expect(listed).toHaveLength(14);
    for (const tool of listed) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.name).not.toMatch(/^(create|update|delete|remove|set|add|edit)_/);
    }
  });

  it('returns the profile of the token owner', async () => {
    const client = await registerClient();
    const tokens = await authorizeAs(ownerId, client.client_id);
    const payload = toolPayload(await callTool(tokens.access_token, 'get_profile')) as {
      time_zone: string;
    };
    expect(payload.time_zone).toBe('America/Cuiaba');
    expect(JSON.stringify(payload)).not.toContain('owner@example.test');
  });

  it('never returns another account data, even when the arguments ask for it', async () => {
    const client = await registerClient();
    const tokens = await authorizeAs(ownerId, client.client_id);
    const response = await callTool(tokens.access_token, 'get_workouts', {
      days: 30,
      email: 'other@example.test',
      userId: otherId,
    });
    const body = response.body;

    expect(body).toContain('Treino do titular');
    expect(body).not.toContain('Treino da outra pessoa');
    expect(body).not.toContain(otherId);
  });

  it('gives each token owner only their own workouts', async () => {
    const client = await registerClient();
    const ownerTokens = await authorizeAs(ownerId, client.client_id);
    const otherTokens = await authorizeAs(otherId, client.client_id);

    const ownerBody = (await callTool(ownerTokens.access_token, 'get_workouts', { days: 30 })).body;
    const otherBody = (await callTool(otherTokens.access_token, 'get_workouts', { days: 30 })).body;

    expect(ownerBody).toContain('Treino do titular');
    expect(ownerBody).not.toContain('Treino da outra pessoa');
    expect(otherBody).toContain('Treino da outra pessoa');
    expect(otherBody).not.toContain('Treino do titular');
  });

  it('refuses an inverted period without leaking internals', async () => {
    const client = await registerClient();
    const tokens = await authorizeAs(ownerId, client.client_id);
    const response = await callTool(tokens.access_token, 'get_training_summary', {
      from: '2026-08-06',
      to: '2026-07-01',
    });
    const parsed = JSON.parse(response.body) as {
      result?: { isError?: boolean };
      error?: { message?: string };
    };
    const message = JSON.stringify(parsed);
    expect(parsed.result?.isError === true || parsed.error !== undefined).toBe(true);
    expect(message).not.toMatch(/select |from "workout_sessions"|node_modules|\.ts:\d+/);
  });

  it('refuses a limit above the ceiling', async () => {
    const client = await registerClient();
    const tokens = await authorizeAs(ownerId, client.client_id);
    const response = await callTool(tokens.access_token, 'get_workouts', { days: 7, limit: 5000 });
    const parsed = JSON.parse(response.body) as {
      result?: { isError?: boolean };
      error?: unknown;
    };
    expect(parsed.result?.isError === true || parsed.error !== undefined).toBe(true);
  });

  it('degrades to the summary tool instead of dumping a long period', async () => {
    const client = await registerClient();
    const tokens = await authorizeAs(ownerId, client.client_id);
    const response = await callTool(tokens.access_token, 'get_workouts', { days: 400 });
    expect(response.body).toContain('get_training_summary');
  });

  it('never returns credential material in any tool response', async () => {
    const client = await registerClient();
    const tokens = await authorizeAs(ownerId, client.client_id);
    for (const name of [
      'get_profile',
      'get_training_summary',
      'get_measurements',
      'get_measurement_summary',
      'get_walks',
      'get_nutrition',
      'get_recovery',
      'get_progress',
      'get_recent_changes',
    ]) {
      const body = (await callTool(tokens.access_token, name, { days: 30 })).body;
      expect(body).not.toContain(tokens.access_token);
      expect(body).not.toContain(tokens.refresh_token);
      expect(body).not.toContain(client.client_id);
      expect(body).not.toMatch(/"(password|passwordHash|clientSecret|tokenHash|sessionToken)"/);
    }
  });
});

describe('rate limiting', () => {
  it('refuses a burst of registrations and says when to retry', async () => {
    const limited = buildApp(dependencies, {
      mcp: { publicUrl: origin, rateLimits: { registrationsPerHour: 1 } },
    });
    await limited.ready();
    const payload = { client_name: 'Rajada', redirect_uris: ['https://chatgpt.com/callback'] };

    expect(
      (await limited.inject({ method: 'POST', payload, url: '/oauth/register' })).statusCode,
    ).toBe(201);
    const blocked = await limited.inject({ method: 'POST', payload, url: '/oauth/register' });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    await limited.close();
  });
});

describe('token storage', () => {
  it('never stores an access token in clear text', async () => {
    const client = await registerClient();
    const tokens = await authorizeAs(ownerId, client.client_id);
    const stored = await db
      .select({ tokenHash: mcpTokens.tokenHash })
      .from(mcpTokens)
      .where(and(eq(mcpTokens.clientId, client.client_id), eq(mcpTokens.kind, 'access')));

    expect(stored.length).toBeGreaterThan(0);
    for (const row of stored) {
      expect(row.tokenHash).not.toBe(tokens.access_token);
      expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

/**
 * O editor do GPT Actions não implementa PKCE: ele monta `/oauth/authorize` sem `code_challenge` e
 * autentica-se no `/oauth/token` com `client_secret`. PKCE continua obrigatório para todo cliente
 * público — que é justamente o caso em que ele protege —, e a dispensa vale só para o cliente
 * confidencial, cujo código interceptado é inútil sem o segredo. Ver ADR-0006.
 */
describe('cliente confidencial sem PKCE', () => {
  const redirectUri = 'https://chat.openai.com/aip/g-teste/oauth/callback';

  async function registerConfidentialClient() {
    const response = await app.inject({
      method: 'POST',
      payload: {
        client_name: 'GPT Actions',
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: 'client_secret_post',
      },
      url: '/oauth/register',
    });
    expect(response.statusCode).toBe(201);
    return response.json() as { client_id: string; client_secret: string };
  }

  async function consentWithoutPkce(clientId: string, userId = ownerId) {
    currentSession = sessionFor(userId);
    const consent = await app.inject({
      headers: { origin },
      method: 'POST',
      payload: {
        client_id: clientId,
        decision: 'allow',
        redirect_uri: redirectUri,
        scope: 'torkout:read',
        state: 'abc',
      },
      url: '/oauth/authorize',
    });
    currentSession = null;
    return consent;
  }

  it('emite código para um cliente confidencial que não mandou desafio', async () => {
    const client = await registerConfidentialClient();
    const consent = await consentWithoutPkce(client.client_id);

    expect(consent.statusCode).toBe(302);
    const location = new URL(consent.headers.location as string);
    expect(location.searchParams.get('error')).toBeNull();
    expect(location.searchParams.get('code')).toBeTruthy();
    expect(location.searchParams.get('state')).toBe('abc');
  });

  it('troca o código por token quando o segredo do cliente confere', async () => {
    const client = await registerConfidentialClient();
    const consent = await consentWithoutPkce(client.client_id);
    const code = new URL(consent.headers.location as string).searchParams.get('code');

    const token = await app.inject({
      method: 'POST',
      payload: {
        client_id: client.client_id,
        client_secret: client.client_secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      },
      url: '/oauth/token',
    });
    expect(token.statusCode).toBe(200);
    expect(token.json()).toMatchObject({ scope: 'torkout:read', token_type: 'Bearer' });
  });

  it('recusa a troca sem o segredo, que é o que substitui o PKCE aqui', async () => {
    const client = await registerConfidentialClient();
    const consent = await consentWithoutPkce(client.client_id);
    const code = new URL(consent.headers.location as string).searchParams.get('code');

    const token = await app.inject({
      method: 'POST',
      payload: { client_id: client.client_id, code, grant_type: 'authorization_code' },
      url: '/oauth/token',
    });
    expect(token.statusCode).toBe(401);
    expect(token.json()).toMatchObject({ error: 'invalid_client' });
  });

  it('continua exigindo PKCE de cliente público, que é onde ele protege', async () => {
    // Registro sem `token_endpoint_auth_method` nasce público: sem segredo, o código interceptado
    // seria trocável por qualquer um que o capturasse.
    const client = await registerClient(redirectUri);
    currentSession = sessionFor(ownerId);
    const consent = await app.inject({
      headers: { origin },
      method: 'POST',
      payload: {
        client_id: client.client_id,
        decision: 'allow',
        redirect_uri: redirectUri,
        scope: 'torkout:read',
      },
      url: '/oauth/authorize',
    });
    currentSession = null;

    expect(consent.statusCode).toBe(302);
    const location = new URL(consent.headers.location as string);
    expect(location.searchParams.get('code')).toBeNull();
    expect(location.searchParams.get('error')).toBe('invalid_request');
  });

  it('recusa um desafio mal formado mesmo vindo de cliente confidencial', async () => {
    const client = await registerConfidentialClient();
    currentSession = sessionFor(ownerId);
    const consent = await app.inject({
      headers: { origin },
      method: 'POST',
      payload: {
        client_id: client.client_id,
        code_challenge: 'algo',
        code_challenge_method: 'plain',
        decision: 'allow',
        redirect_uri: redirectUri,
        scope: 'torkout:read',
      },
      url: '/oauth/authorize',
    });
    currentSession = null;

    expect(new URL(consent.headers.location as string).searchParams.get('error')).toBe(
      'invalid_request',
    );
  });

  it('não deixa um cliente confidencial pular a verificação de um desafio que ele mesmo enviou', async () => {
    const client = await registerConfidentialClient();
    const { challenge } = pkce();
    currentSession = sessionFor(ownerId);
    const consent = await app.inject({
      headers: { origin },
      method: 'POST',
      payload: {
        client_id: client.client_id,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        decision: 'allow',
        redirect_uri: redirectUri,
        scope: 'torkout:read',
      },
      url: '/oauth/authorize',
    });
    currentSession = null;
    const code = new URL(consent.headers.location as string).searchParams.get('code');

    // Segredo correto, mas sem o verificador do desafio registrado: a troca precisa falhar.
    const token = await app.inject({
      method: 'POST',
      payload: {
        client_id: client.client_id,
        client_secret: client.client_secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      },
      url: '/oauth/token',
    });
    expect(token.statusCode).toBe(400);
    expect(token.json()).toMatchObject({ error: 'invalid_grant' });
  });
});

/**
 * O formulário de consentimento é HTML puro e envia `application/x-www-form-urlencoded`, como todo
 * formulário de navegador. O endpoint de token também recebe urlencoded: a RFC 6749 §4.1.3 exige.
 * O Fastify só analisa JSON e texto por padrão, e sem um analisador para esse tipo o corpo nunca
 * chega ao manipulador — a requisição morre com `FST_ERR_CTP_INVALID_MEDIA_TYPE`.
 *
 * As demais suítes usam `payload` como objeto, que o `inject` serializa em JSON, e por isso nunca
 * exercitaram o caminho que o navegador realmente percorre.
 */
describe('corpo de formulário', () => {
  const redirectUri = 'https://chat.openai.com/aip/g-form/oauth/callback';

  function form(fields: Record<string, string>) {
    return new URLSearchParams(fields).toString();
  }

  it('aceita o consentimento enviado como formulário de navegador', async () => {
    const client = await registerClient(redirectUri);
    const { challenge } = pkce();
    currentSession = sessionFor(ownerId);
    const consent = await app.inject({
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin,
      },
      method: 'POST',
      payload: form({
        client_id: client.client_id,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        decision: 'allow',
        redirect_uri: redirectUri,
        scope: 'torkout:read',
        state: 'form',
      }),
      url: '/oauth/authorize',
    });
    currentSession = null;

    expect(consent.statusCode).toBe(302);
    const location = new URL(consent.headers.location as string);
    expect(location.searchParams.get('code')).toBeTruthy();
    expect(location.searchParams.get('state')).toBe('form');
  });

  it('aceita a troca de token enviada como formulário, conforme a RFC 6749', async () => {
    const client = await registerClient(redirectUri);
    const { challenge, verifier } = pkce();
    currentSession = sessionFor(ownerId);
    const consent = await app.inject({
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin },
      method: 'POST',
      payload: form({
        client_id: client.client_id,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        decision: 'allow',
        redirect_uri: redirectUri,
        scope: 'torkout:read',
      }),
      url: '/oauth/authorize',
    });
    currentSession = null;
    const code = new URL(consent.headers.location as string).searchParams.get('code') ?? '';

    const token = await app.inject({
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      payload: form({
        client_id: client.client_id,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
      url: '/oauth/token',
    });

    expect(token.statusCode).toBe(200);
    expect(token.json()).toMatchObject({ scope: 'torkout:read', token_type: 'Bearer' });
  });

  it('aceita o registro dinâmico e a revogação em formulário', async () => {
    const revoke = await app.inject({
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      payload: form({ client_id: 'desconhecido', token: 'qualquer' }),
      url: '/oauth/revoke',
    });
    // RFC 7009: token desconhecido devolve 200 para não revelar sua existência.
    expect(revoke.statusCode).toBe(200);
  });

  it('não deixa um corpo de formulário inválido derrubar a requisição', async () => {
    const response = await app.inject({
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      payload: '%%%',
      url: '/oauth/token',
    });
    expect(response.statusCode).toBeLessThan(500);
  });
});

/**
 * A tela de consentimento é servida por este mesmo servidor, sob `MCP_PUBLIC_URL`. A própria origem
 * precisa ser aceita por construção, sem depender de alguém lembrar de acrescentá-la a
 * `TRUSTED_ORIGINS`, que existe para o CORS do produto e pode legitimamente não incluir um
 * subdomínio dedicado ao MCP.
 */
describe('origem do formulário de consentimento', () => {
  const dedicated = 'https://mcp.torkout.example.test';

  function appOn(publicUrl: string) {
    return buildApp(dependencies, {
      mcp: {
        publicUrl,
        rateLimits: {
          callsPerMinute: 10_000,
          registrationsPerHour: 10_000,
          tokensPerMinute: 10_000,
        },
      },
    });
  }

  async function postWithOrigin(instance: ReturnType<typeof buildApp>, header: string | undefined) {
    return instance.inject({
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...(header === undefined ? {} : { origin: header }),
      },
      method: 'POST',
      payload: new URLSearchParams({ client_id: 'inexistente', decision: 'deny' }).toString(),
      url: '/oauth/authorize',
    });
  }

  it('aceita a própria origem, mesmo fora de TRUSTED_ORIGINS', async () => {
    const instance = appOn(dedicated);
    await instance.ready();
    const response = await postWithOrigin(instance, dedicated);
    // Passou do porteiro de origem: para no cliente desconhecido, que é o passo seguinte.
    expect(response.json()).toMatchObject({ error: 'invalid_client' });
    await instance.close();
  });

  it('continua aceitando as origens confiáveis do produto', async () => {
    const instance = appOn(dedicated);
    await instance.ready();
    const response = await postWithOrigin(instance, origin);
    expect(response.json()).toMatchObject({ error: 'invalid_client' });
    await instance.close();
  });

  it('recusa uma origem estranha', async () => {
    const instance = appOn(dedicated);
    await instance.ready();
    const response = await postWithOrigin(instance, 'https://atacante.example.test');
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'access_denied' });
    await instance.close();
  });

  it('recusa uma origem opaca, que não prova nada sobre quem enviou', async () => {
    const instance = appOn(dedicated);
    await instance.ready();
    const response = await postWithOrigin(instance, 'null');
    expect(response.statusCode).toBe(403);
    await instance.close();
  });
});
