import { expect, test } from '@playwright/test';

test('browses and edits cached history offline on mobile', async ({ page }) => {
  const userId = 'ba000000-0000-4000-8000-000000000001';
  let networkAvailable = true;
  let historyRequests = 0;

  await page.route('**/auth/get-session', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    return route.fulfill({
      json: {
        session: { id: 'session-history', userId },
        user: { id: userId, name: 'Pessoa HistÃ³rica' },
      },
    });
  });
  await page.route('**/api/v1/profile', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    return route.fulfill({
      json: { displayName: 'Pessoa HistÃ³rica', timeZone: 'America/Cuiaba' },
    });
  });
  await page.route('**/api/v1/history?**', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    historyRequests += 1;
    return route.fulfill({
      json: {
        days: [
          {
            habitEntries: [],
            localDate: '2026-07-12',
            measurements: [],
            painReports: [],
            sessions: [
              {
                id: 'ba100000-0000-4000-8000-000000000001',
                plannedLocalDate: '2026-07-12',
                status: 'planned',
                templateNameSnapshot: 'Descanso',
                type: 'rest',
                version: 1,
              },
            ],
          },
          {
            habitEntries: [],
            localDate: '2026-07-13',
            measurements: [
              {
                id: 'ba300000-0000-4000-8000-000000000001',
                localDate: '2026-07-13',
                measuredAt: '2026-07-13T12:00:00.000Z',
                version: 1,
                weightKg: 80,
              },
            ],
            painReports: [],
            sessions: [
              {
                id: 'ba100000-0000-4000-8000-000000000002',
                notes: null,
                plannedLocalDate: '2026-07-13',
                status: 'partial',
                templateNameSnapshot: 'ForÃ§a A',
                type: 'strength',
                version: 1,
              },
              {
                id: 'ba100000-0000-4000-8000-000000000003',
                plannedLocalDate: '2026-07-13',
                status: 'completed',
                templateNameSnapshot: 'Caminhada',
                type: 'walk',
                version: 1,
              },
            ],
          },
        ],
        habits: [],
        nextCursor: null,
      },
    });
  });
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
  await page.route('**/api/v1/sync/push', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    return route.fulfill({ json: { results: [] } });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'CalendÃ¡rio e histÃ³rico' }).click();
  const day13 = page.getByRole('button', { name: '13 de julho de 2026' });
  await expect(day13).toContainText('ForÃ§a');
  await expect(day13).toContainText('Caminhada');
  await day13.click();
  networkAvailable = false;
  await page.getByLabel('ObservaÃ§Ãµes de ForÃ§a A').fill('Ajustado offline');
  await page.getByLabel('ObservaÃ§Ãµes de ForÃ§a A').blur();
  await expect(page.getByRole('status')).toContainText('pendente');

  await page.reload();
  await expect(page.getByText(/modo offline/i)).toBeVisible();
  await page.getByRole('button', { name: 'CalendÃ¡rio e histÃ³rico' }).click();
  await expect(day13).toContainText('ForÃ§a');
  await page.getByRole('button', { name: 'MÃªs anterior' }).click();
  await expect(page.getByRole('heading', { name: /junho de 2026/i })).toBeVisible();
  await page.getByRole('button', { name: 'PrÃ³ximo mÃªs' }).click();
  await expect(page.getByRole('heading', { name: /julho de 2026/i })).toBeVisible();
  expect(historyRequests).toBe(1);
});
