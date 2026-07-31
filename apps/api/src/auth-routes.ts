import type { DatabaseClient } from '@torkout/database';
import { users } from '@torkout/database';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';

import type { ObjectStorage } from './storage.js';

export interface SessionData {
  session: { id: string; userId: string };
  user: { emailVerified: boolean; id: string };
}

export interface AuthRuntime {
  api: {
    deleteUser(input: { body: { password: string }; headers: Headers }): Promise<unknown>;
    getSession(input: { headers: Headers }): Promise<SessionData | null>;
    verifyPassword(input: { body: { password: string }; headers: Headers }): Promise<unknown>;
  };
  handler(request: Request): Promise<Response>;
}

export interface ApiDependencies {
  auth: AuthRuntime;
  database: DatabaseClient;
  /** Armazenamento de objetos usado pelas fotos de evolução; ausente desativa o recurso. */
  storage?: ObjectStorage | undefined;
  trustedOrigins: string[];
}

export class ApiHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface AuthenticatedUser {
  id: string;
  role: 'admin' | 'user';
}

export function requestHeaders(request: FastifyRequest): Headers {
  return fromNodeHeaders(request.headers);
}

export async function requireAuthenticatedUser(
  request: FastifyRequest,
  dependencies: ApiDependencies,
): Promise<AuthenticatedUser> {
  if (['DELETE', 'PATCH', 'POST', 'PUT'].includes(request.method)) {
    const origin = request.headers.origin;
    if (!origin || !dependencies.trustedOrigins.includes(origin)) {
      throw new ApiHttpError(403, 'UNTRUSTED_ORIGIN', 'Origem da solicitação não autorizada.');
    }
  }
  const session = await dependencies.auth.api.getSession({ headers: requestHeaders(request) });
  if (!session?.user.emailVerified) {
    throw new ApiHttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
  }

  const [user] = await dependencies.database
    .select({ banExpires: users.banExpires, banned: users.banned, id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!user) {
    throw new ApiHttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária.');
  }

  const activelyBanned = user.banned && (!user.banExpires || user.banExpires > new Date());
  if (activelyBanned) {
    throw new ApiHttpError(403, 'ACCOUNT_BLOCKED', 'Esta conta está temporariamente indisponível.');
  }
  if (user.banned && user.banExpires && user.banExpires <= new Date()) {
    await dependencies.database
      .update(users)
      .set({ banExpires: null, banReason: null, banned: false, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  return { id: user.id, role: user.role };
}

export function registerAuthRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  app.route({
    handler: async (request, reply) => {
      const baseURL = dependencies.trustedOrigins[0] ?? 'http://localhost';
      const url = new URL(request.url, baseURL);
      const authRequest = new Request(url, {
        headers: requestHeaders(request),
        method: request.method,
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      });
      const response = await dependencies.auth.handler(authRequest);
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header('set-cookie', cookies);
      const body = response.body ? await response.text() : null;
      return reply.send(body);
    },
    method: ['GET', 'POST'],
    url: '/auth/*',
  });
}
