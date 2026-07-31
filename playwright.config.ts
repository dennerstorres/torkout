import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm --filter @torkout/web build && pnpm --filter @torkout/web preview',
    // O E2E exercita a instância que habilita o cadastro, porque a jornada pública inclui registro.
    // A tela com o cadastro fechado — o padrão do produto — é coberta em `AuthScreen.test.tsx`, que
    // não exige um segundo build.
    env: { VITE_PUBLIC_SIGNUP_ENABLED: 'true' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:4173',
  },
});
