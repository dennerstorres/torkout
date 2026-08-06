import { MCP_SCOPE } from '@torkout/contracts';
import { users, type DatabaseClient } from '@torkout/database';
import { eq } from 'drizzle-orm';

import { verifyAccessToken } from '../mcp/oauth.js';

/**
 * Porteiro Bearer das rotas REST de `/api/ai`.
 *
 * Reaproveita o mesmo servidor de autorização OAuth 2.1 do MCP, o mesmo armazenamento de tokens e o
 * mesmo escopo. Não existe segundo emissor, segundo formato de credencial nem token estático: o
 * titular dos dados sai exclusivamente do token verificado, nunca de parâmetro da requisição.
 */

export type BearerRejection =
  | { code: 'insufficient_scope'; message: string; status: 403 }
  | { code: 'invalid_token'; message: string; status: 401 }
  | { code: 'unauthorized'; message: string; status: 401 };

export type BearerOutcome =
  | { granted: false; rejection: BearerRejection }
  | { clientId: string; granted: true; userId: string };

export async function authorizeBearer(
  database: DatabaseClient,
  authorization: string | undefined,
): Promise<BearerOutcome> {
  if (!authorization?.startsWith('Bearer ')) {
    return {
      granted: false,
      rejection: {
        code: 'unauthorized',
        message: 'Autenticação necessária.',
        status: 401,
      },
    };
  }

  const claims = await verifyAccessToken(database, authorization.slice(7).trim());
  if (!claims) {
    return {
      granted: false,
      rejection: {
        code: 'invalid_token',
        message: 'Token inválido ou expirado.',
        status: 401,
      },
    };
  }
  if (claims.scope !== MCP_SCOPE) {
    return {
      granted: false,
      rejection: {
        code: 'insufficient_scope',
        message: `Este recurso exige o escopo ${MCP_SCOPE}.`,
        status: 403,
      },
    };
  }

  const [account] = await database
    .select({ banned: users.banned, id: users.id })
    .from(users)
    .where(eq(users.id, claims.userId))
    .limit(1);
  if (!account || account.banned) {
    return {
      granted: false,
      rejection: {
        code: 'invalid_token',
        message: 'Conta indisponível.',
        status: 401,
      },
    };
  }

  return { clientId: claims.clientId, granted: true, userId: account.id };
}
