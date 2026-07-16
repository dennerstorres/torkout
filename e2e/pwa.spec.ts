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
    background_color: '#0b0f0e',
    display: 'standalone',
    id: '/',
    lang: 'pt-BR',
    short_name: 'Torkout',
    start_url: '/',
    theme_color: '#0b0f0e',
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
  expect(await workerResponse.text()).toContain('torkout-1.0.0');

  const indexResponse = await request.get('/');
  expect(await indexResponse.text()).toContain(
    '<link rel="icon" type="image/svg+xml" href="/icons/torkout-source.svg" />',
  );
  const sourceResponse = await request.get('/icons/torkout-source.svg');
  expect(sourceResponse.ok()).toBe(true);
  expect(await sourceResponse.text()).toContain('fill="#b7df4b"');

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
      corner: [...context.getImageData(0, 0, 1, 1).data],
      center: [...context.getImageData(256, 256, 1, 1).data],
      mark: [...context.getImageData(170, 170, 1, 1).data],
    };
  });
  expect(pixels.corner).toEqual([11, 15, 14, 255]);
  expect(pixels.center).toEqual([16, 22, 0, 255]);
  expect(pixels.mark).toEqual([183, 223, 75, 255]);
});

test('reloads the public app shell while offline after the first successful visit', async ({
  context,
  page,
}) => {
  await page.route('**/auth/get-session', (route) => route.fulfill({ json: null }));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Seu treino, claro até nos dias corridos.' }),
  ).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Seu treino, claro até nos dias corridos.' }),
  ).toBeVisible();
  await context.setOffline(false);
});
