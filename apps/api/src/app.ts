import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { FastifyServerOptions } from 'fastify';

import { registerAccountRoutes } from './account-routes.js';
import { registerAnalyticsRoutes } from './analytics-routes.js';
import { registerAdminRoutes } from './admin-routes.js';
import { registerDailyRoutes } from './daily-routes.js';
import { registerHistoryRoutes } from './history-routes.js';
import { ApiHttpError, type ApiDependencies, registerAuthRoutes } from './auth-routes.js';
import { registerPrivacyRoutes } from './privacy.js';
import { registerProfileRoutes } from './profile-routes.js';
import { registerProgressionRoutes } from './progression-routes.js';
import { registerPhotoRoutes } from './photo-routes.js';
import { registerPlanningRoutes } from './planning-routes.js';
import { registerPortabilityRoutes } from './portability-routes.js';
import { registerSyncRoutes } from './sync-routes.js';
import { registerAiRoutes } from './ai/routes.js';
import { registerMcpRoutes, type McpRouteOptions } from './mcp/routes.js';
import { createMcpRateLimiters } from './mcp/rate-limit.js';
import { OperationalMetrics, securityHeaders } from './operational.js';

export interface BuildAppOptions {
  /**
   * Camada REST somente leitura de `/api/ai`, para clientes que falam OpenAPI em vez de MCP. Só
   * existe junto com `mcp`, porque depende do mesmo servidor OAuth e do mesmo escopo.
   */
  aiRest?: boolean | undefined;
  logger?: FastifyServerOptions['logger'];
  /** Integração MCP somente leitura; ausente mantém o servidor MCP fora da aplicação. */
  mcp?: McpRouteOptions | undefined;
  production?: boolean;
  readiness?: () => Promise<void>;
  trustProxy?: FastifyServerOptions['trustProxy'];
}

export function buildApp(
  dependencies?: ApiDependencies,
  options: BuildAppOptions = {},
): FastifyInstance {
  const metrics = new OperationalMetrics();
  const app = Fastify({
    logger: options.logger ?? false,
    requestIdHeader: 'x-request-id',
    trustProxy: options.trustProxy ?? false,
  });

  app.addHook('onRequest', async (request) => metrics.start(request));
  app.addHook('onResponse', async (request, reply) => metrics.finish(request, reply.statusCode));
  app.addHook('onSend', async (_request, reply) => {
    for (const [name, value] of Object.entries(securityHeaders(options.production ?? false))) {
      // A política global vale para tudo, exceto onde a própria rota já declarou uma. Hoje só a
      // página de consentimento do MCP faz isso, e a dela é mais restritiva que esta.
      if (name === 'content-security-policy' && reply.hasHeader(name)) continue;
      reply.header(name, value);
    }
  });

  app.get('/health/live', async () => ({ status: 'ok' as const }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      if (!options.readiness) throw new Error('Readiness dependency is not configured.');
      await options.readiness();
      return { status: 'ready' as const };
    } catch {
      return reply.status(503).send({ status: 'unavailable' as const });
    }
  });
  app.get('/metrics', async (_request, reply) =>
    reply.type('text/plain; version=0.0.4; charset=utf-8').send(metrics.render()),
  );

  if (dependencies) {
    void app.register(cors, {
      credentials: true,
      methods: ['DELETE', 'GET', 'OPTIONS', 'POST', 'PUT'],
      origin: dependencies.trustedOrigins,
    });
    registerAuthRoutes(app, dependencies);
    registerPrivacyRoutes(app, dependencies);
    registerProfileRoutes(app, dependencies);
    registerPlanningRoutes(app, dependencies);
    registerDailyRoutes(app, dependencies);
    registerPhotoRoutes(app, dependencies);
    registerHistoryRoutes(app, dependencies);
    registerAnalyticsRoutes(app, dependencies);
    registerProgressionRoutes(app, dependencies);
    registerPortabilityRoutes(app, dependencies);
    registerAdminRoutes(app, dependencies);
    registerAccountRoutes(app, dependencies);
    registerSyncRoutes(app, dependencies);
    if (options.mcp) {
      // Um único conjunto de limitadores serve `/mcp` e `/api/ai/*`: são a mesma integração vista
      // por dois protocolos, e um segundo contador dobraria o teto sem que ninguém pedisse.
      const rateLimiters =
        options.mcp.rateLimiters ?? createMcpRateLimiters(options.mcp.rateLimits);
      registerMcpRoutes(app, dependencies, { ...options.mcp, rateLimiters });
      if (options.aiRest !== false) {
        registerAiRoutes(app, dependencies, { publicUrl: options.mcp.publicUrl, rateLimiters });
      }
    }
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiHttpError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        status: error.statusCode,
      });
    }
    request.log.error(
      { errorType: error instanceof Error ? error.name : 'UnknownError', requestId: request.id },
      'request_failed',
    );
    return reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: 'Não foi possível concluir a solicitação.',
      status: 500,
    });
  });

  return app;
}
