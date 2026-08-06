import { sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth.js';
import { timestampColumns } from './common.js';

/**
 * Credenciais do servidor MCP. Não são entidades sincronizáveis: existem só no PostgreSQL, nunca
 * chegam à réplica local e nunca entram na exportação de portabilidade.
 */
export const mcpTokenKindEnum = pgEnum('mcp_token_kind', ['access', 'refresh']);

/**
 * Clientes registrados dinamicamente (RFC 7591). O segredo, quando existe, é guardado apenas como
 * hash; um cliente público com PKCE não tem segredo algum.
 */
export const mcpOauthClients = pgTable('mcp_oauth_clients', {
  /**
   * O próprio identificador emitido no registro dinâmico é a chave primária. Uma chave surrogate
   * exigiria que o índice único de `client_id` existisse antes das chaves estrangeiras que o
   * referenciam, e a migração gerada não garante essa ordem.
   */
  clientId: text('client_id').primaryKey(),
  clientSecretHash: text('client_secret_hash'),
  clientName: text('client_name').notNull(),
  redirectUris: text('redirect_uris').array().notNull(),
  grantTypes: text('grant_types').array().notNull(),
  responseTypes: text('response_types').array().notNull(),
  scope: text('scope').notNull(),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull(),
  disabledAt: timestamp('disabled_at', { mode: 'date', withTimezone: true }),
  ...timestampColumns(),
});

/**
 * Códigos de autorização de vida curta. Guardados como hash e consumidos uma única vez: o carimbo
 * de consumo existe para que uma segunda troca seja recusada em vez de emitir outro token.
 */
export const mcpAuthorizationCodes = pgTable(
  'mcp_authorization_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    codeHash: text('code_hash').notNull(),
    clientId: text('client_id')
      .notNull()
      .references(() => mcpOauthClients.clientId, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    redirectUri: text('redirect_uri').notNull(),
    codeChallenge: text('code_challenge').notNull(),
    codeChallengeMethod: text('code_challenge_method').notNull(),
    scope: text('scope').notNull(),
    resource: text('resource'),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('mcp_authorization_codes_hash_unique').on(table.codeHash),
    index('mcp_authorization_codes_expires_at_idx').on(table.expiresAt),
  ],
);

/**
 * Tokens de acesso e de atualização. O valor claro só existe na resposta que o cria; o banco guarda
 * apenas o hash, de modo que vazamento da base não devolve credencial utilizável.
 */
export const mcpTokens = pgTable(
  'mcp_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: text('token_hash').notNull(),
    kind: mcpTokenKindEnum('kind').notNull(),
    clientId: text('client_id')
      .notNull()
      .references(() => mcpOauthClients.clientId, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    resource: text('resource'),
    /** Cadeia de rotação: um refresh trocado aponta para o token que o substituiu. */
    replacedByTokenHash: text('replaced_by_token_hash'),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { mode: 'date', withTimezone: true }),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('mcp_tokens_hash_unique').on(table.tokenHash),
    index('mcp_tokens_user_kind_idx').on(table.userId, table.kind),
    index('mcp_tokens_expires_at_idx').on(table.expiresAt),
  ],
);

/**
 * Consentimentos concedidos. Guardar o consentimento evita perguntar de novo a cada renovação e dá
 * ao titular um lugar único para revogar o acesso de um cliente.
 */
export const mcpConsents = pgTable(
  'mcp_consents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => mcpOauthClients.clientId, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    grantedAt: timestamp('granted_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),
  },
  (table) => [
    uniqueIndex('mcp_consents_user_client_unique')
      .on(table.userId, table.clientId)
      .where(sql`${table.revokedAt} is null`),
  ],
);
