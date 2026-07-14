import { expect, test } from '@playwright/test';

test('plans offline on a mobile viewport and keeps the outbox across reload', async ({ page }) => {
  const userId = 'b1000000-0000-4000-8000-000000000001';
  let networkAvailable = true;
  let pushedOperations = 0;

  await page.route('**/auth/get-session', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    return route.fulfill({
      json: {
        session: { id: 'session-planning', userId },
        user: { id: userId, name: 'Pessoa Planejadora' },
      },
    });
  });
  await page.route('**/api/v1/profile', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    return route.fulfill({ json: { displayName: 'Pessoa Planejadora' } });
  });
  await page.route('**/api/v1/sync/pull**', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    return route.fulfill({
      json: {
        changes: [],
        cursor: null,
        hasMore: false,
        serverTime: '2026-07-14T18:00:00Z',
      },
    });
  });
  await page.route('**/api/v1/sync/push', async (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    const body = (await route.request().postDataJSON()) as {
      operations: Array<{
        entityId: string;
        operationId: string;
        payload: Record<string, unknown>;
      }>;
    };
    pushedOperations += body.operations.length;
    return route.fulfill({
      json: {
        results: body.operations.map((operation) => ({
          operationId: operation.operationId,
          record: {
            ...operation.payload,
            deletedAt: null,
            id: operation.entityId,
            version: 1,
          },
          status: 'applied',
        })),
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Planejamento' }).click();
  await expect(page.getByRole('heading', { name: 'Planejamento' })).toBeVisible();

  networkAvailable = false;
  await page.getByLabel('Nome do plano').fill('Plano sem rede');
  await page.getByLabel('Nome do treino').fill('Treino offline');
  await page.getByLabel('Segunda-feira').check();
  await page.getByLabel('Sexta-feira').check();
  await page.getByRole('button', { name: 'Salvar planejamento' }).click();
  await expect(page.getByRole('status')).toContainText('salvo localmente');

  await page.reload();
  await expect(page.getByText(/modo offline/i)).toBeVisible();
  await page.getByRole('button', { name: 'Planejamento' }).click();
  await expect(page.getByText('Plano sem rede')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('offline');

  networkAvailable = true;
  await page.getByRole('button', { name: 'Sincronizar agora' }).click();
  await expect.poll(() => pushedOperations).toBeGreaterThanOrEqual(2);
});
