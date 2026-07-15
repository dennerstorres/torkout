import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconDirectory = resolve(root, 'apps/web/public/icons');
const source = await readFile(resolve(iconDirectory, 'torkout-source.svg'), 'utf8');
const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
const targets = [
  ['torkout-192.png', 192, 'transparent'],
  ['torkout-512.png', 512, 'transparent'],
  ['torkout-maskable-512.png', 512, '#16281f'],
  ['apple-touch-icon.png', 180, '#16281f'],
];

await mkdir(iconDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [fileName, size, background] of targets) {
    const page = await browser.newPage({ viewport: { height: size, width: size } });
    await page.setContent(
      `<style>html,body{background:${background};margin:0;width:100%;height:100%;overflow:hidden}img{display:block;width:100%;height:100%}</style><img alt="" src="${imageUrl}">`,
    );
    await page.locator('img').evaluate((image) => image.decode());
    await page.screenshot({
      omitBackground: background === 'transparent',
      path: resolve(iconDirectory, fileName),
    });
    await page.close();
  }
} finally {
  await browser.close();
}
