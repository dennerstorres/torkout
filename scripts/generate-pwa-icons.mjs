import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconDirectory = resolve(root, 'apps/web/public/icons');
const source = await readFile(resolve(iconDirectory, 'torkout-source.svg'), 'utf8');
const maskableSource = await readFile(
  resolve(iconDirectory, 'torkout-maskable-source.svg'),
  'utf8',
);
const targets = [
  ['torkout-192.png', 192, source],
  ['torkout-512.png', 512, source],
  ['torkout-maskable-512.png', 512, maskableSource],
  ['apple-touch-icon.png', 180, source],
];

await mkdir(iconDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [fileName, size, svg] of targets) {
    const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const page = await browser.newPage({ viewport: { height: size, width: size } });
    await page.setContent(
      `<style>html,body{background:transparent;margin:0;width:100%;height:100%;overflow:hidden}img{display:block;width:100%;height:100%}</style><img alt="" src="${imageUrl}">`,
    );
    await page.locator('img').evaluate((image) => image.decode());
    await page.screenshot({
      omitBackground: true,
      path: resolve(iconDirectory, fileName),
    });
    await page.close();
  }
} finally {
  await browser.close();
}
