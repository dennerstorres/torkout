import { expect, test } from '@playwright/test';

test('exports portable data and erases the account plus its local replica on mobile', async ({
  page,
}) => {
  const userId = '6a000000-0000-4000-8000-000000000001';
  let deletionPayload: unknown;

  await page.route('**/auth/get-session', (route) =>
    route.fulfill({
      json: {
        session: { id: 'session-portability', userId },
        user: { id: userId, name: 'Pessoa Portável' },
      },
    }),
  );
  await page.route('**/auth/list-sessions', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/profile', (route) =>
    route.fulfill({ json: { displayName: 'Pessoa Portável', timeZone: 'America/Cuiaba' } }),
  );
  await page.route('**/api/v1/sync/pull**', (route) =>
    route.fulfill({
      json: {
        changes: [],
        cursor: null,
        hasMore: false,
        serverTime: '2026-07-14T20:00:00.000Z',
      },
    }),
  );
  await page.route('**/api/v1/exports', (route) =>
    route.fulfill({
      body: JSON.stringify({ exportedAt: '2026-07-14T20:00:00.000Z', formatVersion: '1.0.0' }),
      contentType: 'application/json',
      headers: { 'content-disposition': 'attachment; filename="torkout-export-2026-07-14.json"' },
    }),
  );
  await page.route('**/api/v1/account', async (route) => {
    deletionPayload = route.request().postDataJSON();
    await route.fulfill({
      json: {
        activeDataDeleted: true,
        backupRetention: {
          appliesTo: 'Backups isolados.',
          maximumDays: 365,
          policy: '7 diárias, 5 semanais e 12 mensais.',
        },
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Conta' }).click();
  await expect(page.getByRole('heading', { name: 'Conta' })).toBeVisible();
  await expect(page.getByText(/7 diárias, 5 semanais e 12 mensais/i)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('torkout-export-2026-07-14.json');

  await page.getByLabel('Digite EXCLUIR MINHA CONTA').fill('EXCLUIR MINHA CONTA');
  await page.getByLabel('Confirme sua senha').fill('correct-password');
  await page.getByRole('button', { name: 'Excluir minha conta' }).click();

  await expect(
    page.getByRole('heading', { name: 'Seu treino, claro até nos dias corridos.' }),
  ).toBeVisible();
  expect(deletionPayload).toEqual({
    confirmation: 'EXCLUIR MINHA CONTA',
    password: 'correct-password',
  });
  await expect
    .poll(() =>
      page.evaluate(async (name) => {
        const databases = await indexedDB.databases();
        return databases.some((database) => database.name === name);
      }, `torkout-replica-v1-${userId}`),
    )
    .toBe(false);
});
