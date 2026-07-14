import { expect, test } from '@playwright/test';

test('opens the public authentication shell', async ({ page }) => {
  await page.route('**/auth/get-session', (route) => route.fulfill({ json: null }));
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Entre no Torkout' })).toBeVisible();
  await expect(page).toHaveTitle('Torkout');
});
