import { auditEvents, sessions, users } from '@torkout/database';
import { adminAccountBlockSchema } from '@torkout/contracts';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ApiHttpError, type ApiDependencies, requireAuthenticatedUser } from './auth-routes.js';

export function registerAdminRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  app.put<{ Params: { userId: string } }>(
    '/api/v1/admin/users/:userId/block',
    async (request, reply) => {
      const actor = await requireAuthenticatedUser(request, dependencies);
      if (actor.role !== 'admin') {
        throw new ApiHttpError(403, 'ADMIN_REQUIRED', 'Acesso administrativo necessário.');
      }
      const userId = z.uuid().safeParse(request.params.userId);
      const input = adminAccountBlockSchema.safeParse(request.body);
      if (!userId.success || !input.success) {
        throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Bloqueio inválido.');
      }
      const expiresAt = input.data.expiresAt ? new Date(input.data.expiresAt) : null;
      await dependencies.database.transaction(async (transaction) => {
        const updated = await transaction
          .update(users)
          .set({
            banExpires: expiresAt,
            banReason: input.data.reason,
            banned: true,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId.data))
          .returning({ id: users.id });
        if (updated.length === 0) {
          throw new ApiHttpError(404, 'USER_NOT_FOUND', 'Conta não encontrada.');
        }
        await transaction.delete(sessions).where(eq(sessions.userId, userId.data));
        await transaction.insert(auditEvents).values({
          actorType: 'user',
          eventType: 'account.blocked',
          metadata: { expiresAt: input.data.expiresAt, reason: input.data.reason },
          subjectId: userId.data,
          subjectType: 'user',
          userId: actor.id,
        });
      });
      return reply.status(204).send();
    },
  );
}
