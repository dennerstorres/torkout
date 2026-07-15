import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('publishes a complete installable manifest and versioned service worker', async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as Record<string, unknown>;
  expect(manifest).toMatchObject({
    display: 'standalone',
    id: '/',
    lang: 'pt-BR',
    short_name: 'Torkout',
    start_url: '/',
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512' }),
      expect.objectContaining({ purpose: 'maskable' }),
    ]),
  );

  const workerResponse = await request.get('/sw.js');
  expect(workerResponse.ok()).toBe(true);
  expect(await workerResponse.text()).toContain('torkout-0.11.0');

  await page.goto('/icons/torkout-maskable-512.png');
  const pixels = await page.evaluate(() => {
    const image = document.querySelector('img');
    if (!image) throw new Error('Maskable icon did not render.');
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.drawImage(image, 0, 0);
    return {
      center: [...context.getImageData(256, 256, 1, 1).data],
      corner: [...context.getImageData(0, 0, 1, 1).data],
    };
  });
  expect(pixels.corner).toEqual([22, 40, 31, 255]);
  expect(pixels.center).toEqual([36, 91, 60, 255]);
});

test('reloads the public app shell while offline after the first successful visit', async ({
  context,
  page,
}) => {
  await page.route('**/auth/get-session', (route) => route.fulfill({ json: null }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entre no Torkout' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Entre no Torkout' })).toBeVisible();
  await context.setOffline(false);
});
