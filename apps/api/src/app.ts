import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerAccountRoutes } from './account-routes.js';
import { registerAdminRoutes } from './admin-routes.js';
import { registerDailyRoutes } from './daily-routes.js';
import { ApiHttpError, type ApiDependencies, registerAuthRoutes } from './auth-routes.js';
import { registerPrivacyRoutes } from './privacy.js';
import { registerProfileRoutes } from './profile-routes.js';
import { registerProgressionRoutes } from './progression-routes.js';
import { registerPlanningRoutes } from './planning-routes.js';
import { registerSyncRoutes } from './sync-routes.js';

export function buildApp(dependencies?: ApiDependencies): FastifyInstance {
  const app = Fastify({
    logger: false,
  });

  app.get('/health/live', async () => ({ status: 'ok' as const }));

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
    registerProgressionRoutes(app, dependencies);
    registerAdminRoutes(app, dependencies);
    registerAccountRoutes(app, dependencies);
    registerSyncRoutes(app, dependencies);
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiHttpError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        status: error.statusCode,
      });
    }
    return reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: 'Não foi possível concluir a solicitação.',
      status: 500,
    });
  });

  return app;
}
