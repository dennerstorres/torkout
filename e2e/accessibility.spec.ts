import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectWcagAa(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

test('public authentication and installation guidance have no automatic WCAG AA violations', async ({
  page,
}) => {
  await page.route('**/auth/get-session', (route) => route.fulfill({ json: null }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entre no Torkout' })).toBeVisible();
  await page.getByText('Como instalar').click();
  await expectWcagAa(page);
});

test('keyboard users can skip global controls and reach the main journey', async ({ page }) => {
  await page.route('**/auth/get-session', (route) => route.fulfill({ json: null }));
  await page.goto('/');

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo principal' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('authenticated home has no automatic WCAG AA violations', async ({ page }) => {
  const userId = 'ee000000-0000-4000-8000-000000000001';
  await page.route('**/auth/get-session', (route) =>
    route.fulfill({
      json: {
        session: { id: 'session-accessibility', userId },
        user: { id: userId, name: 'Pessoa Acessível' },
      },
    }),
  );
  await page.route('**/api/v1/profile', (route) =>
    route.fulfill({ json: { displayName: 'Pessoa Acessível', timeZone: 'America/Cuiaba' } }),
  );
  await page.route('**/api/v1/sync/pull**', (route) =>
    route.fulfill({
      json: {
        changes: [],
        cursor: null,
        hasMore: false,
        serverTime: '2026-07-14T20:00:00Z',
      },
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await expectWcagAa(page);
});
