import { MCP_SCOPE } from '@torkout/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ApiDependencies } from '../auth-routes.js';
import { createMcpRateLimiters, type McpRateLimiters } from '../mcp/rate-limit.js';
import { authorizeBearer } from './bearer.js';
import { AiRequestError, createAiOperations, type AiOperations } from './operations.js';
import {
  parseComparePeriodsQuery,
  parseExercise,
  parseLimit,
  parseRangeQuery,
  parseStatus,
  type QueryString,
} from './query-params.js';

/**
 * Camada REST somente leitura de `/api/ai`, desenhada para GPT Actions.
 *
 * É uma segunda porta para a mesma casa: as operações, as regras e os limites são os de
 * `./operations.ts`, exatamente os que as ferramentas MCP usam. Nada aqui consulta o banco por conta
 * própria e nada aqui escreve — todas as rotas são `GET`.
 */

export const AI_BASE_PATH = '/api/ai';

export interface AiRouteOptions {
  /** URL pública usada no `WWW-Authenticate`, para o cliente achar os metadados do OAuth. */
  publicUrl: string;
  rateLimiters?: McpRateLimiters | undefined;
}

export interface AiEndpoint {
  operationId: string;
  /** Caminho relativo a `/api/ai`. */
  path: string;
  run(operations: AiOperations, query: QueryString): Promise<unknown>;
}

/**
 * Inventário dos endpoints. É a fonte única consumida pelo registro de rotas e pelo teste que
 * confere o documento OpenAPI: um endpoint novo sem contrapartida documentada reprova.
 */
export const AI_ENDPOINTS: readonly AiEndpoint[] = [
  {
    operationId: 'getProfile',
    path: '/profile',
    run: async (operations) => operations.getProfile(),
  },
  {
    operationId: 'getTrainingSummary',
    path: '/training-summary',
    run: async (operations, query) => operations.getTrainingSummary(parseRangeQuery(query)),
  },
  {
    operationId: 'getWorkouts',
    path: '/workouts',
    run: async (operations, query) =>
      operations.getWorkouts({
        ...parseRangeQuery(query),
        ...parseLimit(query),
        ...parseExercise(query, false),
        ...parseStatus(query),
      }),
  },
  {
    operationId: 'getLastWorkout',
    path: '/last-workout',
    run: async (operations, query) => operations.getLastWorkout(parseExercise(query, false)),
  },
  {
    operationId: 'getExerciseProgress',
    path: '/exercise-progress',
    run: async (operations, query) =>
      operations.getExerciseProgress({ ...parseRangeQuery(query), ...parseExercise(query, true) }),
  },
  {
    operationId: 'getMeasurements',
    path: '/measurements',
    run: async (operations, query) =>
      operations.getMeasurements({ ...parseRangeQuery(query), ...parseLimit(query) }),
  },
  {
    operationId: 'getMeasurementSummary',
    path: '/measurement-summary',
    run: async (operations, query) => operations.getMeasurementSummary(parseRangeQuery(query)),
  },
  {
    operationId: 'getWalks',
    path: '/walks',
    run: async (operations, query) => operations.getWalks(parseRangeQuery(query)),
  },
  {
    operationId: 'getNutrition',
    path: '/nutrition',
    run: async (operations, query) => operations.getNutrition(parseRangeQuery(query)),
  },
  {
    operationId: 'getWheyHistory',
    path: '/whey-history',
    run: async (operations, query) =>
      operations.getWheyHistory({ ...parseRangeQuery(query), ...parseLimit(query) }),
  },
  {
    operationId: 'getRecovery',
    path: '/recovery',
    run: async (operations, query) =>
      operations.getRecovery({ ...parseRangeQuery(query), ...parseLimit(query) }),
  },
  {
    operationId: 'getProgress',
    path: '/progress',
    run: async (operations, query) => operations.getProgress(parseRangeQuery(query)),
  },
  {
    operationId: 'getRecentChanges',
    path: '/recent-changes',
    run: async (operations, query) => operations.getRecentChanges(parseRangeQuery(query)),
  },
  {
    operationId: 'comparePeriods',
    path: '/compare-periods',
    run: async (operations, query) => operations.comparePeriods(parseComparePeriodsQuery(query)),
  },
];

function clientAddress(request: FastifyRequest): string {
  return request.ip || 'unknown';
}

/** Toda falha sai no mesmo envelope curto: código estável e uma frase em português. */
function failure(reply: FastifyReply, status: number, code: string, message: string): FastifyReply {
  return reply
    .status(status)
    .type('application/json; charset=utf-8')
    .send({ error: code, message });
}

export function registerAiRoutes(
  app: FastifyInstance,
  dependencies: ApiDependencies,
  options: AiRouteOptions,
): void {
  const issuer = new URL(options.publicUrl).origin;
  const limiters = options.rateLimiters ?? createMcpRateLimiters();

  app.get(`${AI_BASE_PATH}/health`, async (_request, reply) =>
    reply.header('cache-control', 'no-store').send({ scope: MCP_SCOPE, status: 'ok' }),
  );

  for (const endpoint of AI_ENDPOINTS) {
    app.get(`${AI_BASE_PATH}${endpoint.path}`, async (request, reply) => {
      const startedAt = process.hrtime.bigint();

      const wait = limiters.calls.check(clientAddress(request));
      if (wait !== null) {
        reply.header('retry-after', String(wait));
        return failure(
          reply,
          429,
          'rate_limited',
          'Muitas chamadas. Tente novamente em instantes.',
        );
      }

      const outcome = await authorizeBearer(dependencies.database, request.headers.authorization);
      if (!outcome.granted) {
        const { code, message, status } = outcome.rejection;
        if (status === 401) {
          reply.header(
            'www-authenticate',
            `Bearer realm="torkout", error="invalid_token", error_description="${message}", resource_metadata="${issuer}/.well-known/oauth-protected-resource"`,
          );
        }
        return failure(reply, status, code, message);
      }

      // As operações nascem amarradas ao usuário do token. Nada da requisição influencia isso.
      const operations = createAiOperations({
        database: dependencies.database,
        userId: outcome.userId,
      });

      let status = 200;
      try {
        const payload = await endpoint.run(operations, (request.query ?? {}) as QueryString);
        reply.header('cache-control', 'no-store').type('application/json; charset=utf-8');
        return await reply.send(payload);
      } catch (error) {
        if (error instanceof AiRequestError) {
          status = error.status;
          return failure(reply, error.status, error.code, error.message);
        }
        // O inesperado não vaza detalhe: o diagnóstico fica no log, pela identificação da requisição.
        status = 500;
        request.log.error(
          { operationId: endpoint.operationId, requestId: request.id },
          'ai_request_failed',
        );
        return failure(reply, 500, 'internal_error', 'Não foi possível concluir a solicitação.');
      } finally {
        // Identificador do usuário como prefixo curto: rastreável sem expor a conta. Corpo, medidas,
        // dores, alimentação, token e `Authorization` nunca são registrados.
        request.log.info(
          {
            clientId: outcome.clientId,
            durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
            operationId: endpoint.operationId,
            status,
            subject: outcome.userId.slice(0, 8),
          },
          'ai_request',
        );
      }
    });
  }
}
