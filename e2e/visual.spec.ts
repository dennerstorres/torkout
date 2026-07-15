import { expect, test, type Page } from '@playwright/test';

const userId = 'd6000000-0000-4000-8000-000000000001';

async function mockToday(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-07-14T20:00:00Z'));
  await page.route('**/auth/get-session', (route) =>
    route.fulfill({
      json: { session: { id: 'visual-session', userId }, user: { id: userId, name: 'Marina' } },
    }),
  );
  await page.route('**/api/v1/profile', (route) =>
    route.fulfill({ json: { displayName: 'Marina', timeZone: 'America/Cuiaba' } }),
  );
  await page.route('**/api/v1/sessions?**', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            exercises: [],
            id: 'd6100000-0000-4000-8000-000000000001',
            jointPainStatus: 'unknown',
            plannedLocalDate: '2026-07-14',
            status: 'planned',
            templateNameSnapshot: 'Força e mobilidade',
            type: 'strength',
            version: 1,
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/habits', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            active: true,
            id: 'd6200000-0000-4000-8000-000000000001',
            name: 'Hidratação',
            options: [],
            sortOrder: 0,
            type: 'boolean',
            version: 1,
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/habits/entries?**', (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route('**/api/v1/pain-reports?**', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/v1/measurements?**', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/v1/sync/pull**', (route) =>
    route.fulfill({
      json: { changes: [], cursor: null, hasMore: false, serverTime: '2026-07-14T20:00:00Z' },
    }),
  );
  await page.route('**/api/v1/sync/push', (route) => route.fulfill({ json: { results: [] } }));
}

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`premium Today baseline — ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockToday(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`today-${viewport.name}.png`, { animations: 'disabled' });
  });
}
