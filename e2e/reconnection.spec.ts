import { expect, test } from '@playwright/test';

test('retries a committed batch after a lost response without duplicating local records', async ({
  page,
}) => {
  const userId = 'e1000000-0000-4000-8000-000000000001';
  let pushAttempts = 0;
  let initialBatchSize = 0;
  const committed = new Map<string, Record<string, unknown>>();

  await page.route('**/auth/get-session', (route) =>
    route.fulfill({
      json: {
        session: { id: 'session-reconnection', userId },
        user: { id: userId, name: 'Pessoa Reconectada' },
      },
    }),
  );
  await page.route('**/api/v1/profile', (route) =>
    route.fulfill({ json: { displayName: 'Pessoa Reconectada' } }),
  );
  await page.route('**/api/v1/sync/pull**', (route) =>
    route.fulfill({
      json: {
        changes: [
          {
            changedAt: '2026-07-15T14:00:00Z',
            deletedAt: null,
            entityId: 'e1100000-0000-4000-8000-000000000001',
            entityType: 'exercise',
            operation: 'create',
            payload: {
              active: true,
              category: 'força',
              deletedAt: null,
              id: 'e1100000-0000-4000-8000-000000000001',
              instructions: null,
              name: 'Flexão',
              trackingMetric: 'repetitions',
              version: 1,
            },
            sequence: 1,
            version: 1,
          },
        ],
        cursor: Buffer.from(JSON.stringify({ sequence: 1, version: 1 })).toString('base64url'),
        hasMore: false,
        serverTime: '2026-07-15T14:00:00Z',
      },
    }),
  );
  await page.route('**/api/v1/sync/push', async (route) => {
    pushAttempts += 1;
    const body = (await route.request().postDataJSON()) as {
      operations: Array<{
        entityId: string;
        operationId: string;
        payload: Record<string, unknown>;
      }>;
    };
    if (pushAttempts === 1) initialBatchSize = body.operations.length;
    for (const operation of body.operations) {
      committed.set(operation.operationId, {
        ...operation.payload,
        deletedAt: null,
        id: operation.entityId,
        version: 1,
      });
    }
    if (pushAttempts === 1) return route.abort('connectionreset');
    return route.fulfill({
      json: {
        results: body.operations.map((operation) => ({
          operationId: operation.operationId,
          record: committed.get(operation.operationId),
          status: 'duplicate',
        })),
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Planejamento' }).click();
  await page.getByRole('button', { name: 'Plano semanal' }).click();
  await page.getByLabel('Nome do plano').fill('Plano resiliente');
  await page.getByLabel('Nome do treino').fill('Treino resiliente');
  await page.getByLabel('Segunda-feira').check();
  await page.getByRole('button', { name: 'Salvar planejamento' }).click();

  await page.getByLabel('Abrir detalhes da sincronização').click();
  const syncDetails = page.getByRole('region', { name: 'Sincronização' });
  await syncDetails.getByRole('button', { name: 'Sincronizar agora' }).click();
  await expect(page.getByText('Não foi possível sincronizar. Nada foi perdido.')).toBeVisible();
  await expect(syncDetails.getByRole('status')).toContainText(
    `${initialBatchSize} alterações pendentes`,
  );

  await syncDetails.getByRole('button', { name: 'Sincronizar agora' }).click();
  await expect(syncDetails.getByRole('status')).toContainText('0 alterações pendentes');
  await expect(syncDetails.getByRole('status')).toContainText('Tudo sincronizado');
  expect(pushAttempts).toBe(2);
  expect(initialBatchSize).toBeGreaterThan(2);
  expect(committed.size).toBe(initialBatchSize);
});
