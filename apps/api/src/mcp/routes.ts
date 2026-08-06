import { MCP_SCOPE } from '@torkout/contracts';
import { users } from '@torkout/database';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';

import { type ApiDependencies, requestHeaders } from '../auth-routes.js';
import { createMcpRateLimiters, type McpRateLimiters, type McpRateLimits } from './rate-limit.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  OAuthError,
  SUPPORTED_CODE_CHALLENGE_METHODS,
  SUPPORTED_GRANT_TYPES,
  SUPPORTED_RESPONSE_TYPES,
  createAuthorizationCode,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  findClient,
  hasConsent,
  normalizeRequestedScope,
  recordConsent,
  registerClient,
  revokeToken,
  validateRedirectUri,
  verifyAccessToken,
} from './oauth.js';
import { connectTransport, createMcpServer, createStatelessTransport } from './server.js';

export type { McpRateLimits } from './rate-limit.js';
export { DEFAULT_MCP_RATE_LIMITS } from './rate-limit.js';

export interface McpRouteOptions {
  /** URL pública, com esquema e host, sob a qual o MCP e o OAuth são alcançados. */
  publicUrl: string;
  rateLimits?: Partial<McpRateLimits> | undefined;
  /** Limitadores já construídos, para que `/mcp` e `/api/ai/*` dividam o mesmo contador. */
  rateLimiters?: McpRateLimiters | undefined;
}

const MCP_PATH = '/mcp';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function clientAddress(request: FastifyRequest): string {
  return request.ip || 'unknown';
}

function oauthErrorReply(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof OAuthError) {
    return reply
      .status(error.status)
      .send({ error: error.code, error_description: error.description });
  }
  return reply
    .status(400)
    .send({ error: 'invalid_request', error_description: 'Solicitação inválida.' });
}

/** Redireciona o erro ao cliente quando o `redirect_uri` já é confiável (RFC 6749 §4.1.2.1). */
function redirectError(
  reply: FastifyReply,
  redirectUri: string,
  code: string,
  description: string,
  state: string | undefined,
): FastifyReply {
  const target = new URL(redirectUri);
  target.searchParams.set('error', code);
  target.searchParams.set('error_description', description);
  if (state !== undefined) target.searchParams.set('state', state);
  return reply.redirect(target.toString(), 302);
}

function page(options: { body: string; nonce: string; title: string }): string {
  return [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow">',
    `<title>${escapeHtml(options.title)}</title>`,
    `<style nonce="${options.nonce}">`,
    ':root{color-scheme:light dark}',
    'body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.5;margin:0;padding:24px;max-width:34rem}',
    'h1{font-size:1.4rem;margin:0 0 16px}',
    'h2{font-size:1.05rem;margin:24px 0 16px}',
    'p,ul{margin:0 0 16px}',
    'ul{padding-left:20px}',
    'li{margin-bottom:8px}',
    '.client{font-weight:600}',
    '.actions{display:flex;flex-wrap:wrap;gap:16px;margin-top:24px}',
    'button{font:inherit;padding:12px 20px;border-radius:8px;border:1px solid currentColor;cursor:pointer;min-height:44px}',
    'button[value="allow"]{background:#14532d;color:#fff;border-color:#14532d}',
    '.notice{border-left:4px solid currentColor;padding-left:16px}',
    '</style>',
    '</head>',
    `<body>${options.body}</body>`,
    '</html>',
  ].join('\n');
}

/**
 * A página de consentimento declara a própria política, mais restritiva que a global: sem script,
 * sem imagem, sem conexão, e estilo apenas pelo nonce desta resposta.
 */
function sendPage(reply: FastifyReply, nonce: string, html: string, status = 200): FastifyReply {
  return reply
    .status(status)
    .header(
      'content-security-policy',
      `default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; style-src 'nonce-${nonce}'`,
    )
    .header('cache-control', 'no-store')
    .type('text/html; charset=utf-8')
    .send(html);
}

export function registerMcpRoutes(
  app: FastifyInstance,
  dependencies: ApiDependencies,
  options: McpRouteOptions,
): void {
  const issuer = new URL(options.publicUrl).origin;
  const resourceUrl = `${issuer}${MCP_PATH}`;
  const limiters = options.rateLimiters ?? createMcpRateLimiters(options.rateLimits);
  const registerLimiter = limiters.registrations;
  const tokenLimiter = limiters.tokens;
  const callLimiter = limiters.calls;

  const protectedResourceMetadata = {
    authorization_servers: [issuer],
    bearer_methods_supported: ['header'],
    resource: resourceUrl,
    resource_documentation: `${issuer}/docs/MCP.md`,
    scopes_supported: [MCP_SCOPE],
  };

  const authorizationServerMetadata = {
    code_challenge_methods_supported: [...SUPPORTED_CODE_CHALLENGE_METHODS],
    grant_types_supported: [...SUPPORTED_GRANT_TYPES],
    issuer,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: [...SUPPORTED_RESPONSE_TYPES],
    revocation_endpoint: `${issuer}/oauth/revoke`,
    scopes_supported: [MCP_SCOPE],
    token_endpoint: `${issuer}/oauth/token`,
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    authorization_endpoint: `${issuer}/oauth/authorize`,
  };

  // RFC 9728. O caminho com sufixo é o que clientes MCP consultam para um recurso em subcaminho.
  for (const url of [
    '/.well-known/oauth-protected-resource',
    `/.well-known/oauth-protected-resource${MCP_PATH}`,
  ]) {
    app.get(url, async (_request, reply) => reply.send(protectedResourceMetadata));
  }
  // RFC 8414.
  for (const url of [
    '/.well-known/oauth-authorization-server',
    `/.well-known/oauth-authorization-server${MCP_PATH}`,
  ]) {
    app.get(url, async (_request, reply) => reply.send(authorizationServerMetadata));
  }

  // RFC 7591 — registro dinâmico, exigido pelo conector do ChatGPT.
  app.post('/oauth/register', async (request, reply) => {
    const wait = registerLimiter.check(clientAddress(request));
    if (wait !== null) {
      return reply.status(429).header('retry-after', String(wait)).send({
        error: 'temporarily_unavailable',
        error_description: 'Muitos registros. Tente mais tarde.',
      });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    try {
      const client = await registerClient(dependencies.database, {
        clientName: typeof body.client_name === 'string' ? body.client_name : undefined,
        grantTypes: Array.isArray(body.grant_types) ? (body.grant_types as string[]) : undefined,
        redirectUris: Array.isArray(body.redirect_uris) ? (body.redirect_uris as string[]) : [],
        responseTypes: Array.isArray(body.response_types)
          ? (body.response_types as string[])
          : undefined,
        scope: typeof body.scope === 'string' ? body.scope : undefined,
        tokenEndpointAuthMethod:
          typeof body.token_endpoint_auth_method === 'string'
            ? body.token_endpoint_auth_method
            : undefined,
      });
      request.log.info({ clientName: client.clientName }, 'mcp_client_registered');
      return reply.status(201).send({
        client_id: client.clientId,
        client_id_issued_at: client.clientIdIssuedAt,
        client_name: client.clientName,
        grant_types: [...SUPPORTED_GRANT_TYPES],
        redirect_uris: client.redirectUris,
        response_types: [...SUPPORTED_RESPONSE_TYPES],
        scope: client.scope,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
        ...(client.clientSecret ? { client_secret: client.clientSecret } : {}),
      });
    } catch (error) {
      return oauthErrorReply(reply, error);
    }
  });

  async function authorizeContext(request: FastifyRequest) {
    const query = request.query as Record<string, string | undefined>;
    const clientId = query.client_id;
    if (!clientId) throw new OAuthError('invalid_request', 'Informe `client_id`.');
    const client = await findClient(dependencies.database, clientId);
    if (!client) throw new OAuthError('invalid_client', 'Cliente desconhecido.', 401);
    if (!validateRedirectUri(client.redirectUris, query.redirect_uri)) {
      throw new OAuthError('invalid_request', '`redirect_uri` não registrado para este cliente.');
    }
    return { client, query, redirectUri: query.redirect_uri ?? client.redirectUris[0]! };
  }

  app.get('/oauth/authorize', async (request, reply) => {
    let context: Awaited<ReturnType<typeof authorizeContext>>;
    try {
      context = await authorizeContext(request);
    } catch (error) {
      // Sem `redirect_uri` confiável o erro fica na própria página, nunca é repassado adiante.
      return oauthErrorReply(reply, error);
    }
    const { client, query, redirectUri } = context;
    const nonce = randomBytes(16).toString('base64');

    if (query.response_type !== 'code') {
      return redirectError(
        reply,
        redirectUri,
        'unsupported_response_type',
        'Use `response_type=code`.',
        query.state,
      );
    }
    if (!query.code_challenge || query.code_challenge_method !== 'S256') {
      return redirectError(
        reply,
        redirectUri,
        'invalid_request',
        'Este servidor exige PKCE com S256.',
        query.state,
      );
    }
    let scope: string;
    try {
      scope = normalizeRequestedScope(query.scope);
    } catch (error) {
      const failure = error instanceof OAuthError ? error : null;
      return redirectError(
        reply,
        redirectUri,
        failure?.code ?? 'invalid_scope',
        failure?.description ?? 'Escopo não suportado.',
        query.state,
      );
    }

    const session = await dependencies.auth.api.getSession({ headers: requestHeaders(request) });
    if (!session?.user.emailVerified) {
      return sendPage(
        reply,
        nonce,
        page({
          body: [
            '<h1>Entre na sua conta para continuar</h1>',
            `<p>O aplicativo <span class="client">${escapeHtml(client.clientName)}</span> pediu acesso de leitura aos seus dados do Torkout, mas você ainda não está autenticado neste navegador.</p>`,
            `<p>Abra o <a href="${escapeHtml(issuer)}/">Torkout</a>, entre na sua conta e volte a esta página.</p>`,
            '<form method="get"><button type="submit">Já entrei, continuar</button></form>',
          ].join('\n'),
          nonce,
          title: 'Entrar — Torkout',
        }),
        401,
      );
    }

    const [account] = await dependencies.database
      .select({ banned: users.banned, id: users.id })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (!account || account.banned) {
      return redirectError(reply, redirectUri, 'access_denied', 'Conta indisponível.', query.state);
    }

    // Consentimento já concedido antes não é perguntado de novo a cada renovação.
    if (
      await hasConsent(dependencies.database, { clientId: client.clientId, userId: account.id })
    ) {
      const code = await createAuthorizationCode(dependencies.database, {
        clientId: client.clientId,
        codeChallenge: query.code_challenge,
        codeChallengeMethod: 'S256',
        redirectUri,
        resource: query.resource,
        scope,
        userId: account.id,
      });
      const target = new URL(redirectUri);
      target.searchParams.set('code', code);
      if (query.state !== undefined) target.searchParams.set('state', query.state);
      request.log.info({ clientId: client.clientId }, 'mcp_authorization_granted');
      return reply.redirect(target.toString(), 302);
    }

    const hidden = Object.entries({
      client_id: client.clientId,
      code_challenge: query.code_challenge,
      code_challenge_method: 'S256',
      redirect_uri: redirectUri,
      resource: query.resource ?? '',
      scope,
      state: query.state ?? '',
    })
      .map(
        ([name, value]) =>
          `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(String(value))}">`,
      )
      .join('');

    return sendPage(
      reply,
      nonce,
      page({
        body: [
          '<h1>Autorizar acesso de leitura</h1>',
          `<p>O aplicativo <span class="client">${escapeHtml(client.clientName)}</span> pediu para <strong>ler</strong> os seus dados do Torkout.</p>`,
          '<h2>O que ele poderá ver</h2>',
          '<ul>',
          '<li>Perfil de treino: altura, objetivo, horário preferido e fuso.</li>',
          '<li>Treinos, exercícios, séries e repetições.</li>',
          '<li>Medidas corporais, incluindo peso, cintura e barriga.</li>',
          '<li>Caminhadas, alimentação registrada e consumo de whey.</li>',
          '<li>Esforço percebido e registros de dor muscular e articular.</li>',
          '</ul>',
          '<h2>O que ele não poderá fazer</h2>',
          '<ul>',
          '<li>Criar, alterar ou apagar qualquer registro.</li>',
          '<li>Ver sua senha, seus tokens ou suas fotos de evolução.</li>',
          '<li>Alcançar dados de qualquer outra pessoa.</li>',
          '</ul>',
          '<p class="notice">Estes são dados de saúde. Autorize apenas aplicativos em que você confia. Você pode revogar o acesso a qualquer momento.</p>',
          `<form method="post" action="/oauth/authorize">${hidden}`,
          '<div class="actions">',
          '<button type="submit" name="decision" value="allow">Autorizar leitura</button>',
          '<button type="submit" name="decision" value="deny">Recusar</button>',
          '</div>',
          '</form>',
        ].join('\n'),
        nonce,
        title: 'Autorizar acesso — Torkout',
      }),
    );
  });

  app.post('/oauth/authorize', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string | undefined>;
    // O formulário é enviado da própria origem; uma origem estranha não decide consentimento.
    const origin = request.headers.origin;
    if (origin !== undefined && !dependencies.trustedOrigins.includes(origin)) {
      return reply
        .status(403)
        .send({ error: 'access_denied', error_description: 'Origem não autorizada.' });
    }

    const clientId = body.client_id;
    if (!clientId)
      return oauthErrorReply(reply, new OAuthError('invalid_request', 'Informe `client_id`.'));
    const client = await findClient(dependencies.database, clientId);
    if (!client)
      return oauthErrorReply(reply, new OAuthError('invalid_client', 'Cliente desconhecido.', 401));
    if (!validateRedirectUri(client.redirectUris, body.redirect_uri)) {
      return oauthErrorReply(
        reply,
        new OAuthError('invalid_request', '`redirect_uri` não registrado.'),
      );
    }
    const redirectUri = body.redirect_uri ?? client.redirectUris[0]!;
    const state = body.state === '' ? undefined : body.state;

    const session = await dependencies.auth.api.getSession({ headers: requestHeaders(request) });
    if (!session?.user.emailVerified) {
      return reply
        .status(401)
        .send({ error: 'access_denied', error_description: 'Autenticação necessária.' });
    }
    if (body.decision !== 'allow') {
      request.log.info({ clientId: client.clientId }, 'mcp_authorization_denied');
      return redirectError(
        reply,
        redirectUri,
        'access_denied',
        'Acesso recusado pelo titular.',
        state,
      );
    }
    if (!body.code_challenge || body.code_challenge_method !== 'S256') {
      return redirectError(
        reply,
        redirectUri,
        'invalid_request',
        'Este servidor exige PKCE com S256.',
        state,
      );
    }

    let scope: string;
    try {
      scope = normalizeRequestedScope(body.scope);
    } catch (error) {
      return oauthErrorReply(reply, error);
    }

    await recordConsent(dependencies.database, {
      clientId: client.clientId,
      scope,
      userId: session.user.id,
    });
    const code = await createAuthorizationCode(dependencies.database, {
      clientId: client.clientId,
      codeChallenge: body.code_challenge,
      codeChallengeMethod: 'S256',
      redirectUri,
      resource: body.resource === '' ? undefined : body.resource,
      scope,
      userId: session.user.id,
    });
    const target = new URL(redirectUri);
    target.searchParams.set('code', code);
    if (state !== undefined) target.searchParams.set('state', state);
    request.log.info({ clientId: client.clientId }, 'mcp_authorization_granted');
    return reply.redirect(target.toString(), 302);
  });

  app.post('/oauth/token', async (request, reply) => {
    const wait = tokenLimiter.check(clientAddress(request));
    if (wait !== null) {
      return reply
        .status(429)
        .header('retry-after', String(wait))
        .send({ error: 'temporarily_unavailable', error_description: 'Muitas trocas de token.' });
    }
    const body = (request.body ?? {}) as Record<string, string | undefined>;

    // `client_secret_basic`: as credenciais chegam no cabeçalho, não no corpo.
    let clientId = body.client_id;
    let clientSecret = body.client_secret;
    const authorization = request.headers.authorization;
    if (authorization?.startsWith('Basic ')) {
      const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      if (separator > 0) {
        clientId = decodeURIComponent(decoded.slice(0, separator));
        clientSecret = decodeURIComponent(decoded.slice(separator + 1));
      }
    }
    if (!clientId) {
      return oauthErrorReply(reply, new OAuthError('invalid_client', 'Informe `client_id`.', 401));
    }

    try {
      reply.header('cache-control', 'no-store');
      if (body.grant_type === 'authorization_code') {
        if (!body.code) throw new OAuthError('invalid_request', 'Informe `code`.');
        const tokens = await exchangeAuthorizationCode(dependencies.database, {
          clientId,
          clientSecret,
          code: body.code,
          codeVerifier: body.code_verifier,
          redirectUri: body.redirect_uri,
        });
        request.log.info({ clientId }, 'mcp_token_issued');
        return reply.send(tokens);
      }
      if (body.grant_type === 'refresh_token') {
        if (!body.refresh_token)
          throw new OAuthError('invalid_request', 'Informe `refresh_token`.');
        const tokens = await exchangeRefreshToken(dependencies.database, {
          clientId,
          clientSecret,
          refreshToken: body.refresh_token,
        });
        request.log.info({ clientId }, 'mcp_token_refreshed');
        return reply.send(tokens);
      }
      throw new OAuthError('unsupported_grant_type', 'Tipo de concessão não suportado.');
    } catch (error) {
      if (!(error instanceof OAuthError)) {
        request.log.error({ requestId: request.id }, 'mcp_token_failed');
      }
      return oauthErrorReply(reply, error);
    }
  });

  app.post('/oauth/revoke', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string | undefined>;
    if (body.client_id && body.token) {
      await revokeToken(dependencies.database, { clientId: body.client_id, token: body.token });
    }
    // RFC 7009: a resposta é 200 mesmo para token desconhecido, para não revelar sua existência.
    return reply.status(200).send({});
  });

  function unauthorized(reply: FastifyReply, description: string): FastifyReply {
    return reply
      .status(401)
      .header(
        'www-authenticate',
        `Bearer realm="torkout", error="invalid_token", error_description="${description}", resource_metadata="${issuer}/.well-known/oauth-protected-resource${MCP_PATH}"`,
      )
      .send({
        error: { code: -32001, message: description },
        id: null,
        jsonrpc: '2.0',
      });
  }

  app.post(MCP_PATH, async (request, reply) => {
    const wait = callLimiter.check(clientAddress(request));
    if (wait !== null) {
      return reply
        .status(429)
        .header('retry-after', String(wait))
        .send({ error: { code: -32000, message: 'Muitas chamadas.' }, id: null, jsonrpc: '2.0' });
    }

    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return unauthorized(reply, 'Autenticação necessária.');
    }
    const claims = await verifyAccessToken(dependencies.database, authorization.slice(7).trim());
    if (!claims) return unauthorized(reply, 'Token inválido ou expirado.');
    if (claims.scope !== MCP_SCOPE) return unauthorized(reply, 'Escopo insuficiente.');

    const [account] = await dependencies.database
      .select({ banned: users.banned, id: users.id })
      .from(users)
      .where(eq(users.id, claims.userId))
      .limit(1);
    if (!account || account.banned) return unauthorized(reply, 'Conta indisponível.');

    const startedAt = process.hrtime.bigint();
    const method =
      typeof (request.body as { method?: unknown })?.method === 'string'
        ? (request.body as { method: string }).method
        : 'unknown';

    // O servidor nasce amarrado ao usuário do token. Nada do corpo da requisição influencia isso.
    const server = createMcpServer({ database: dependencies.database, userId: account.id });
    const transport = createStatelessTransport();
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await connectTransport(server, transport);
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch {
      request.log.error({ method, requestId: request.id }, 'mcp_request_failed');
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { 'content-type': 'application/json' });
        reply.raw.end(
          JSON.stringify({
            error: { code: -32603, message: 'Erro interno.' },
            id: null,
            jsonrpc: '2.0',
          }),
        );
      }
    }

    // Identificador do usuário registrado como prefixo curto: rastreável sem expor a conta no log.
    request.log.info(
      {
        clientId: claims.clientId,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
        method,
        subject: account.id.slice(0, 8),
      },
      'mcp_request',
    );
    reply.hijack();
    return reply;
  });

  // O transporte sem estado não abre fluxo de servidor para cliente nem mantém sessão a encerrar.
  app.route({
    handler: async (_request, reply) =>
      reply
        .status(405)
        .header('allow', 'POST')
        .send({
          error: { code: -32000, message: 'Este endpoint aceita apenas POST.' },
          id: null,
          jsonrpc: '2.0',
        }),
    method: ['DELETE', 'GET'],
    url: MCP_PATH,
  });

  app.get('/mcp/health', async (_request, reply) =>
    reply.send({
      scope: MCP_SCOPE,
      status: 'ok',
      token_lifetime_seconds: ACCESS_TOKEN_TTL_SECONDS,
    }),
  );
}
