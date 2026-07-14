import { auditEvents } from '@torkout/database';
import { accountDeletionSchema } from '@torkout/contracts';
import type { FastifyInstance } from 'fastify';

import {
  ApiHttpError,
  type ApiDependencies,
  requestHeaders,
  requireAuthenticatedUser,
} from './auth-routes.js';

export function registerAccountRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  app.delete('/api/v1/account', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const parsed = accountDeletionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Confirmação de exclusão inválida.');
    }
    const headers = requestHeaders(request);
    try {
      await dependencies.auth.api.verifyPassword({
        body: { password: parsed.data.password },
        headers,
      });
    } catch {
      throw new ApiHttpError(401, 'REAUTHENTICATION_FAILED', 'Senha incorreta.');
    }

    await dependencies.database.insert(auditEvents).values({
      actorType: 'user',
      eventType: 'account.deletion_requested',
      subjectId: user.id,
      subjectType: 'user',
      userId: user.id,
    });
    await dependencies.auth.api.deleteUser({
      body: { password: parsed.data.password },
      headers,
    });
    return reply.status(204).send();
  });
}
