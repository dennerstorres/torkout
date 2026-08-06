import { MCP_SCOPE } from '@torkout/contracts';
import {
  mcpAuthorizationCodes,
  mcpConsents,
  mcpOauthClients,
  mcpTokens,
  type DatabaseClient,
} from '@torkout/database';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull, lt, or } from 'drizzle-orm';

/**
 * Servidor de autorização OAuth 2.1 do MCP.
 *
 * O consentimento reaproveita a sessão do Better Auth: quem autoriza é o próprio titular já
 * autenticado no produto. Nenhuma credencial é guardada em claro — o banco só vê hashes SHA-256 de
 * valores aleatórios de 256 bits, para os quais um hash lento não acrescentaria segurança.
 */

export const AUTHORIZATION_CODE_TTL_SECONDS = 60;
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export const SUPPORTED_GRANT_TYPES = ['authorization_code', 'refresh_token'] as const;
export const SUPPORTED_RESPONSE_TYPES = ['code'] as const;
/** OAuth 2.1 e a especificação MCP exigem PKCE; `plain` não é aceito. */
export const SUPPORTED_CODE_CHALLENGE_METHODS = ['S256'] as const;

export class OAuthError extends Error {
  constructor(
    readonly code: string,
    readonly description: string,
    readonly status = 400,
  ) {
    super(description);
  }
}

export function issueCredential(): string {
  return randomBytes(32).toString('base64url');
}

export function hashCredential(credential: string): string {
  return createHash('sha256').update(credential).digest('hex');
}

function constantTimeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyPkce(
  challenge: string,
  method: string,
  verifier: string | undefined,
): boolean {
  if (method !== 'S256' || !verifier) return false;
  return constantTimeEquals(createHash('sha256').update(verifier).digest('base64url'), challenge);
}

/** Comparação exata de `redirect_uri`, sem prefixo e sem curinga. */
export function validateRedirectUri(registered: string[], requested: string | undefined): boolean {
  if (requested === undefined) return registered.length > 0;
  return registered.includes(requested);
}

export function normalizeRequestedScope(requested: string | undefined): string {
  if (requested === undefined || requested.trim() === '') return MCP_SCOPE;
  const asked = requested.trim().split(/\s+/);
  const unsupported = asked.filter((scope) => scope !== MCP_SCOPE);
  if (unsupported.length > 0) {
    throw new OAuthError(
      'invalid_scope',
      `Este servidor concede apenas o escopo ${MCP_SCOPE}, que é somente leitura.`,
    );
  }
  return MCP_SCOPE;
}

export interface RegisterClientInput {
  clientName?: string | undefined;
  grantTypes?: string[] | undefined;
  redirectUris: string[];
  responseTypes?: string[] | undefined;
  scope?: string | undefined;
  tokenEndpointAuthMethod?: string | undefined;
}

export interface RegisteredClient {
  clientId: string;
  clientIdIssuedAt: number;
  clientName: string;
  clientSecret?: string;
  redirectUris: string[];
  scope: string;
  tokenEndpointAuthMethod: string;
}

export async function registerClient(
  database: DatabaseClient,
  input: RegisterClientInput,
): Promise<RegisteredClient> {
  if (input.redirectUris.length === 0) {
    throw new OAuthError('invalid_redirect_uri', 'Informe ao menos um `redirect_uri`.');
  }
  for (const uri of input.redirectUris) {
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      throw new OAuthError('invalid_redirect_uri', 'Um `redirect_uri` informado não é uma URL.');
    }
    // Um cliente remoto só é aceito sobre HTTPS; `localhost` existe para desenvolvimento local.
    const isLoopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !isLoopback) {
      throw new OAuthError('invalid_redirect_uri', 'Um `redirect_uri` remoto precisa usar HTTPS.');
    }
    if (parsed.hash !== '') {
      throw new OAuthError('invalid_redirect_uri', 'Um `redirect_uri` não pode conter fragmento.');
    }
  }

  const scope = normalizeRequestedScope(input.scope);
  const authMethod = input.tokenEndpointAuthMethod ?? 'none';
  if (
    authMethod !== 'none' &&
    authMethod !== 'client_secret_post' &&
    authMethod !== 'client_secret_basic'
  ) {
    throw new OAuthError(
      'invalid_client_metadata',
      'Método de autenticação do cliente não suportado.',
    );
  }

  const clientId = issueCredential();
  const clientSecret = authMethod === 'none' ? undefined : issueCredential();
  await database.insert(mcpOauthClients).values({
    clientId,
    clientName: input.clientName ?? 'Cliente MCP',
    clientSecretHash: clientSecret ? hashCredential(clientSecret) : null,
    grantTypes: input.grantTypes ?? [...SUPPORTED_GRANT_TYPES],
    redirectUris: input.redirectUris,
    responseTypes: input.responseTypes ?? [...SUPPORTED_RESPONSE_TYPES],
    scope,
    tokenEndpointAuthMethod: authMethod,
  });

  return {
    clientId,
    clientIdIssuedAt: Math.floor(Date.now() / 1000),
    clientName: input.clientName ?? 'Cliente MCP',
    redirectUris: input.redirectUris,
    scope,
    tokenEndpointAuthMethod: authMethod,
    ...(clientSecret ? { clientSecret } : {}),
  };
}

export async function findClient(database: DatabaseClient, clientId: string) {
  const [client] = await database
    .select()
    .from(mcpOauthClients)
    .where(and(eq(mcpOauthClients.clientId, clientId), isNull(mcpOauthClients.disabledAt)))
    .limit(1);
  return client;
}

export interface CreateAuthorizationCodeInput {
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  resource?: string | undefined;
  scope: string;
  userId: string;
}

export async function createAuthorizationCode(
  database: DatabaseClient,
  input: CreateAuthorizationCodeInput,
  now = new Date(),
): Promise<string> {
  if (!SUPPORTED_CODE_CHALLENGE_METHODS.includes(input.codeChallengeMethod as 'S256')) {
    throw new OAuthError('invalid_request', 'Este servidor exige PKCE com `S256`.');
  }
  const code = issueCredential();
  await database.insert(mcpAuthorizationCodes).values({
    clientId: input.clientId,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    codeHash: hashCredential(code),
    expiresAt: new Date(now.getTime() + AUTHORIZATION_CODE_TTL_SECONDS * 1_000),
    redirectUri: input.redirectUri,
    resource: input.resource ?? null,
    scope: input.scope,
    userId: input.userId,
  });
  return code;
}

export async function recordConsent(
  database: DatabaseClient,
  input: { clientId: string; scope: string; userId: string },
): Promise<void> {
  await database
    .insert(mcpConsents)
    .values({ clientId: input.clientId, scope: input.scope, userId: input.userId })
    .onConflictDoNothing();
}

export async function hasConsent(
  database: DatabaseClient,
  input: { clientId: string; userId: string },
): Promise<boolean> {
  const [consent] = await database
    .select({ id: mcpConsents.id })
    .from(mcpConsents)
    .where(
      and(
        eq(mcpConsents.clientId, input.clientId),
        eq(mcpConsents.userId, input.userId),
        isNull(mcpConsents.revokedAt),
      ),
    )
    .limit(1);
  return consent !== undefined;
}

export interface IssuedTokens {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: 'Bearer';
}

async function issueTokenPair(
  database: DatabaseClient,
  input: { clientId: string; resource: string | null; scope: string; userId: string },
  now: Date,
): Promise<IssuedTokens> {
  const accessToken = issueCredential();
  const refreshToken = issueCredential();
  await database.insert(mcpTokens).values([
    {
      clientId: input.clientId,
      expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1_000),
      kind: 'access',
      resource: input.resource,
      scope: input.scope,
      tokenHash: hashCredential(accessToken),
      userId: input.userId,
    },
    {
      clientId: input.clientId,
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1_000),
      kind: 'refresh',
      resource: input.resource,
      scope: input.scope,
      tokenHash: hashCredential(refreshToken),
      userId: input.userId,
    },
  ]);
  return {
    access_token: accessToken,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: input.scope,
    token_type: 'Bearer',
  };
}

async function authenticateClient(
  database: DatabaseClient,
  clientId: string,
  clientSecret: string | undefined,
) {
  const client = await findClient(database, clientId);
  if (!client) throw new OAuthError('invalid_client', 'Cliente desconhecido.', 401);
  if (client.clientSecretHash !== null) {
    if (
      !clientSecret ||
      !constantTimeEquals(hashCredential(clientSecret), client.clientSecretHash)
    ) {
      throw new OAuthError('invalid_client', 'Credencial de cliente inválida.', 401);
    }
  }
  return client;
}

export async function exchangeAuthorizationCode(
  database: DatabaseClient,
  input: {
    clientId: string;
    clientSecret?: string | undefined;
    code: string;
    codeVerifier?: string | undefined;
    redirectUri?: string | undefined;
  },
  now = new Date(),
): Promise<IssuedTokens> {
  await authenticateClient(database, input.clientId, input.clientSecret);

  const [record] = await database
    .select()
    .from(mcpAuthorizationCodes)
    .where(eq(mcpAuthorizationCodes.codeHash, hashCredential(input.code)))
    .limit(1);
  if (!record) throw new OAuthError('invalid_grant', 'Código de autorização inválido.');
  if (record.clientId !== input.clientId) {
    throw new OAuthError('invalid_grant', 'Código de autorização inválido.');
  }
  if (record.expiresAt <= now) {
    throw new OAuthError('invalid_grant', 'Código de autorização expirado.');
  }
  if (record.consumedAt !== null) {
    // Reuso de código é sinal de vazamento: todo token daquela concessão é revogado.
    await revokeTokensForClient(database, record.userId, record.clientId, now);
    throw new OAuthError('invalid_grant', 'Código de autorização já utilizado.');
  }
  if (input.redirectUri !== undefined && input.redirectUri !== record.redirectUri) {
    throw new OAuthError('invalid_grant', 'O `redirect_uri` não confere com o da autorização.');
  }
  if (!verifyPkce(record.codeChallenge, record.codeChallengeMethod, input.codeVerifier)) {
    throw new OAuthError('invalid_grant', 'O `code_verifier` não confere com o desafio PKCE.');
  }

  // Consumo condicionado ao estado anterior: duas trocas simultâneas não emitem dois tokens.
  const consumed = await database
    .update(mcpAuthorizationCodes)
    .set({ consumedAt: now })
    .where(and(eq(mcpAuthorizationCodes.id, record.id), isNull(mcpAuthorizationCodes.consumedAt)))
    .returning({ id: mcpAuthorizationCodes.id });
  if (consumed.length === 0) {
    throw new OAuthError('invalid_grant', 'Código de autorização já utilizado.');
  }

  return issueTokenPair(
    database,
    {
      clientId: record.clientId,
      resource: record.resource,
      scope: record.scope,
      userId: record.userId,
    },
    now,
  );
}

export async function exchangeRefreshToken(
  database: DatabaseClient,
  input: { clientId: string; clientSecret?: string | undefined; refreshToken: string },
  now = new Date(),
): Promise<IssuedTokens> {
  await authenticateClient(database, input.clientId, input.clientSecret);

  const hash = hashCredential(input.refreshToken);
  const [record] = await database
    .select()
    .from(mcpTokens)
    .where(and(eq(mcpTokens.tokenHash, hash), eq(mcpTokens.kind, 'refresh')))
    .limit(1);
  if (!record || record.clientId !== input.clientId) {
    throw new OAuthError('invalid_grant', 'Token de atualização inválido.');
  }
  if (record.revokedAt !== null) {
    // Um refresh já rotacionado sendo reapresentado indica cópia vazada.
    await revokeTokensForClient(database, record.userId, record.clientId, now);
    throw new OAuthError('invalid_grant', 'Token de atualização já utilizado.');
  }
  if (record.expiresAt <= now) {
    throw new OAuthError('invalid_grant', 'Token de atualização expirado.');
  }

  const tokens = await issueTokenPair(
    database,
    {
      clientId: record.clientId,
      resource: record.resource,
      scope: record.scope,
      userId: record.userId,
    },
    now,
  );
  await database
    .update(mcpTokens)
    .set({
      replacedByTokenHash: hashCredential(tokens.refresh_token),
      revokedAt: now,
      updatedAt: now,
    })
    .where(eq(mcpTokens.id, record.id));
  return tokens;
}

export interface AccessTokenClaims {
  clientId: string;
  scope: string;
  userId: string;
}

/**
 * Resolve o token apresentado no dono real dos dados. Este é o único ponto em que o usuário de uma
 * chamada MCP é decidido; nenhum argumento de tool participa dessa decisão.
 */
export async function verifyAccessToken(
  database: DatabaseClient,
  token: string,
  now = new Date(),
): Promise<AccessTokenClaims | null> {
  const [record] = await database
    .select()
    .from(mcpTokens)
    .where(and(eq(mcpTokens.tokenHash, hashCredential(token)), eq(mcpTokens.kind, 'access')))
    .limit(1);
  if (!record || record.revokedAt !== null || record.expiresAt <= now) return null;

  await database.update(mcpTokens).set({ lastUsedAt: now }).where(eq(mcpTokens.id, record.id));
  return { clientId: record.clientId, scope: record.scope, userId: record.userId };
}

export async function revokeToken(
  database: DatabaseClient,
  input: { clientId: string; token: string },
  now = new Date(),
): Promise<void> {
  await database
    .update(mcpTokens)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(mcpTokens.tokenHash, hashCredential(input.token)),
        eq(mcpTokens.clientId, input.clientId),
        isNull(mcpTokens.revokedAt),
      ),
    );
}

export async function revokeTokensForClient(
  database: DatabaseClient,
  userId: string,
  clientId: string,
  now = new Date(),
): Promise<void> {
  await database
    .update(mcpTokens)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(mcpTokens.userId, userId),
        eq(mcpTokens.clientId, clientId),
        isNull(mcpTokens.revokedAt),
      ),
    );
}

/** Higiene de base: códigos e tokens vencidos não precisam ser guardados. */
export async function purgeExpiredCredentials(
  database: DatabaseClient,
  now = new Date(),
): Promise<void> {
  await database.delete(mcpAuthorizationCodes).where(lt(mcpAuthorizationCodes.expiresAt, now));
  await database
    .delete(mcpTokens)
    .where(
      or(
        lt(mcpTokens.expiresAt, now),
        and(eq(mcpTokens.kind, 'access'), lt(mcpTokens.expiresAt, now)),
      ),
    );
}
