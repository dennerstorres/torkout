import { expect, test } from '@playwright/test';

test('tracks Today offline on mobile and survives reload', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-14T20:00:00Z'));
  const userId = 'b6000000-0000-4000-8000-000000000001';
  const sessionId = 'b6100000-0000-4000-8000-000000000001';
  const exerciseId = 'b6100000-0000-4000-8000-000000000002';
  const setId = 'b6100000-0000-4000-8000-000000000003';
  let networkAvailable = true;
  let pushedExecution = false;

  await page.route('**/auth/get-session', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    return route.fulfill({
      json: {
        session: { id: 'session-today', userId },
        user: { id: userId, name: 'Pessoa de Hoje' },
      },
    });
  });
  await page.route('**/api/v1/profile', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    return route.fulfill({
      json: { displayName: 'Pessoa de Hoje', timeZone: 'America/Cuiaba' },
    });
  });
  await page.route('**/api/v1/sessions?**', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    return route.fulfill({
      json: {
        items: [
          {
            exercises: [
              {
                id: exerciseId,
                name: 'Flexão',
                notes: null,
                sets: [
                  {
                    actualRepetitions: null,
                    completed: false,
                    id: setId,
                    plannedRepetitions: 12,
                    setNumber: 1,
                  },
                ],
                status: 'planned',
                trackingMetric: 'repetitions',
              },
            ],
            id: sessionId,
            jointPainStatus: 'unknown',
            plannedLocalDate: '2026-07-14',
            status: 'planned',
            templateNameSnapshot: 'Treino móvel',
            type: 'strength',
            version: 1,
          },
        ],
      },
    });
  });
  await page.route('**/api/v1/habits', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/v1/habits/entries?**', (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route('**/api/v1/pain-reports?**', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/v1/measurements?**', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/v1/sync/pull**', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    return route.fulfill({
      json: {
        changes: [],
        cursor: null,
        hasMore: false,
        serverTime: '2026-07-14T20:00:00Z',
      },
    });
  });
  await page.route('**/api/v1/sync/push', async (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    const request = (await route.request().postDataJSON()) as {
      operations: Array<{
        entityId: string;
        operationId: string;
        payload: Record<string, unknown>;
      }>;
    };
    pushedExecution ||= request.operations.some(
      (operation) => operation.entityId === sessionId && 'execution' in operation.payload,
    );
    return route.fulfill({
      json: {
        results: request.operations.map((operation) => ({
          operationId: operation.operationId,
          record: {
            ...operation.payload,
            deletedAt: null,
            id: operation.entityId,
            version: 2,
          },
          status: 'applied',
        })),
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Hoje' }).click();
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar Treino móvel' }).click();

  networkAvailable = false;
  await page.getByLabel('Série 1 de Flexão').fill('10');
  await expect(page.getByRole('status')).toContainText('Salvo localmente');
  await page.reload();
  await expect(page.getByText(/Você está offline/i)).toBeVisible();
  await page.getByRole('button', { name: 'Hoje' }).click();
  await page.getByRole('button', { name: 'Iniciar Treino móvel' }).click();
  await expect(page.getByLabel('Série 1 de Flexão')).toHaveValue('10');
  await page.getByLabel('Confirmo que não houve dor articular').check();

  networkAvailable = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByLabel('Abrir detalhes da sincronização').click();
  await page
    .getByRole('region', { name: 'Sincronização' })
    .getByRole('button', { name: 'Sincronizar agora' })
    .click();
  await expect.poll(() => pushedExecution).toBe(true);
});
