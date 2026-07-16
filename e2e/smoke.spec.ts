import { expect, test } from '@playwright/test';

test('opens the public authentication shell', async ({ page }) => {
  await page.route('**/auth/get-session', (route) => route.fulfill({ json: null }));
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Seu treino, claro até nos dias corridos.',
    }),
  ).toBeVisible();
  await expect(page).toHaveTitle('Torkout');
});
