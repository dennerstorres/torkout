import { describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

const protectedRoutes = [
  ['GET', '/api/v1/profile'],
  ['PUT', '/api/v1/profile'],
  ['POST', '/api/v1/privacy/acceptances'],
  ['GET', '/api/v1/exercises'],
  ['POST', '/api/v1/exercises'],
  ['PUT', '/api/v1/exercises/00000000-0000-4000-8000-000000000001'],
  ['DELETE', '/api/v1/exercises/00000000-0000-4000-8000-000000000001'],
  ['GET', '/api/v1/plans'],
  ['POST', '/api/v1/plans'],
  ['PUT', '/api/v1/plans/00000000-0000-4000-8000-000000000001'],
  ['DELETE', '/api/v1/plans/00000000-0000-4000-8000-000000000001'],
  ['GET', '/api/v1/templates'],
  ['GET', '/api/v1/templates/00000000-0000-4000-8000-000000000001'],
  ['POST', '/api/v1/templates'],
  ['PUT', '/api/v1/templates/00000000-0000-4000-8000-000000000001'],
  ['DELETE', '/api/v1/templates/00000000-0000-4000-8000-000000000001'],
  ['GET', '/api/v1/sessions?from=2026-07-01&through=2026-07-31'],
  ['POST', '/api/v1/sessions'],
  ['PUT', '/api/v1/sessions/00000000-0000-4000-8000-000000000001'],
  ['PUT', '/api/v1/sessions/00000000-0000-4000-8000-000000000001/execution'],
  ['POST', '/api/v1/sessions/materialize'],
  ['GET', '/api/v1/pain-reports?localDate=2026-07-14'],
  ['POST', '/api/v1/pain-reports'],
  ['PUT', '/api/v1/pain-reports/00000000-0000-4000-8000-000000000001'],
  ['GET', '/api/v1/habits'],
  ['POST', '/api/v1/habits'],
  ['PUT', '/api/v1/habits/00000000-0000-4000-8000-000000000001'],
  ['GET', '/api/v1/habits/entries?localDate=2026-07-14'],
  ['PUT', '/api/v1/habits/00000000-0000-4000-8000-000000000001/entries/2026-07-14'],
  ['GET', '/api/v1/measurements?localDate=2026-07-14'],
  ['POST', '/api/v1/measurements'],
  ['GET', '/api/v1/coffee-intakes?localDate=2026-07-14'],
  ['PUT', '/api/v1/coffee-intakes/2026-07-14'],
  ['GET', '/api/v1/whey-intakes?localDate=2026-07-14'],
  ['POST', '/api/v1/whey-intakes'],
  ['PUT', '/api/v1/whey-intakes/00000000-0000-4000-8000-000000000001'],
  ['DELETE', '/api/v1/whey-intakes/00000000-0000-4000-8000-000000000001'],
  ['POST', '/api/v1/sessions/00000000-0000-4000-8000-000000000001/recovery'],
  ['GET', '/api/v1/progress-photos'],
  ['GET', '/api/v1/progress-photos/comparison?from=2026-07-01&to=2026-07-14'],
  ['POST', '/api/v1/progress-photos'],
  ['GET', '/api/v1/progress-photos/00000000-0000-4000-8000-000000000001/content'],
  ['DELETE', '/api/v1/progress-photos/00000000-0000-4000-8000-000000000001'],
  ['GET', '/api/v1/history?from=2026-07-01&through=2026-07-31'],
  ['GET', '/api/v1/progress?from=2026-07-01&through=2026-07-31'],
  ['GET', '/api/v1/progress/panel?from=2026-07-01&through=2026-07-31'],
  ['GET', '/api/v1/progression/suggestions'],
  ['POST', '/api/v1/progression/evaluate'],
  ['POST', '/api/v1/progression/suggestions/00000000-0000-4000-8000-000000000001/decisions'],
  ['POST', '/api/v1/sync/push'],
  ['GET', '/api/v1/sync/pull'],
  ['POST', '/api/v1/exports'],
  ['DELETE', '/api/v1/account'],
  ['PUT', '/api/v1/admin/users/00000000-0000-4000-8000-000000000001/block'],
] as const;

describe('default-deny product authorization', () => {
  it.each(protectedRoutes)('%s %s rejects an anonymous request', async (method, url) => {
    const app = buildApp({
      auth: {
        api: {
          deleteUser: async () => undefined,
          getSession: async () => null,
          verifyPassword: async () => undefined,
        },
        handler: async () => Response.json({}),
      },
      database: {} as never,
      trustedOrigins: ['https://torkout.example.test'],
    });

    const response = await app.inject({
      headers: { origin: 'https://torkout.example.test' },
      method,
      ...(['DELETE', 'POST', 'PUT'].includes(method) ? { payload: {} } : {}),
      url,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    await app.close();
  });
});
