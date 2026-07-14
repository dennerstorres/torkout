import {
  progressionDecisionCreateSchema,
  progressionSuggestionQuerySchema,
} from '@torkout/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ApiHttpError, type ApiDependencies, requireAuthenticatedUser } from './auth-routes.js';
import {
  decideProgressionSuggestion,
  evaluateProgressionForSession,
  listProgressionSuggestions,
} from './progression-service.js';

const idParamsSchema = z.strictObject({ id: z.uuid() });
const evaluateSchema = z.strictObject({ sessionId: z.uuid() });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Dados inválidos.');
  return result.data;
}

export function registerProgressionRoutes(
  app: FastifyInstance,
  dependencies: ApiDependencies,
): void {
  app.get('/api/v1/progression/suggestions', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { status } = parse(progressionSuggestionQuerySchema, request.query);
    return {
      items: await listProgressionSuggestions(dependencies.database, user.id, status),
    };
  });

  app.post('/api/v1/progression/evaluate', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { sessionId } = parse(evaluateSchema, request.body);
    await evaluateProgressionForSession(dependencies.database, user.id, sessionId);
    return reply.status(202).send({ accepted: true });
  });

  app.post('/api/v1/progression/suggestions/:id/decisions', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const input = parse(progressionDecisionCreateSchema, request.body);
    return decideProgressionSuggestion(dependencies.database, user.id, id, input);
  });
}
