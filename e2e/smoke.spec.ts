import { expect, test } from '@playwright/test';

test('opens the mobile application shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Torkout' })).toBeVisible();
  await expect(page).toHaveTitle('Torkout');
});
