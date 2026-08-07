import { readFileSync } from 'node:fs';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { SERVER_OWNED_PATH_PATTERNS } from './src/pwa-routes.js';

const webPackage = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(webPackage.version),
  },
  plugins: [
    react(),
    VitePWA({
      injectRegister: null,
      manifest: {
        background_color: '#0b0f0e',
        categories: ['fitness', 'lifestyle'],
        description: 'Planejamento e registro local-first de treinos e hábitos.',
        dir: 'ltr',
        display: 'standalone',
        icons: [
          {
            sizes: '192x192',
            src: '/icons/torkout-192.png',
            type: 'image/png',
          },
          {
            sizes: '512x512',
            src: '/icons/torkout-512.png',
            type: 'image/png',
          },
          {
            purpose: 'maskable',
            sizes: '512x512',
            src: '/icons/torkout-maskable-512.png',
            type: 'image/png',
          },
        ],
        id: '/',
        lang: 'pt-BR',
        name: 'Torkout — Acompanhamento de treinos',
        orientation: 'any',
        scope: '/',
        short_name: 'Torkout',
        start_url: '/',
        theme_color: '#0b0f0e',
      },
      registerType: 'prompt',
      workbox: {
        cacheId: `torkout-${webPackage.version}`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // Sem esta exclusão, a navegação para uma página do servidor — a tela de consentimento
        // OAuth, por exemplo — é respondida com a casca do aplicativo, e o servidor nunca é
        // consultado. Ver `src/pwa-routes.ts`.
        navigateFallbackDenylist: [...SERVER_OWNED_PATH_PATTERNS],
        runtimeCaching: [
          {
            handler: 'NetworkOnly',
            urlPattern: ({ url }: { url: URL }) =>
              SERVER_OWNED_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname)),
          },
          {
            handler: 'NetworkFirst',
            options: {
              cacheName: `torkout-pages-${webPackage.version}`,
              expiration: { maxAgeSeconds: 7 * 24 * 60 * 60, maxEntries: 4 },
              networkTimeoutSeconds: 3,
            },
            urlPattern: ({ request }) => request.mode === 'navigate',
          },
          {
            handler: 'CacheFirst',
            options: {
              cacheName: `torkout-images-${webPackage.version}`,
              expiration: { maxAgeSeconds: 30 * 24 * 60 * 60, maxEntries: 32 },
            },
            urlPattern: ({ request }) => request.destination === 'image',
          },
          {
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: `torkout-fonts-${webPackage.version}`,
              expiration: { maxAgeSeconds: 365 * 24 * 60 * 60, maxEntries: 8 },
            },
            urlPattern: ({ request }) => request.destination === 'font',
          },
        ],
        skipWaiting: false,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/auth': 'http://127.0.0.1:3000',
    },
  },
});
