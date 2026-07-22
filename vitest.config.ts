import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          environment: 'node',
          include: [
            'apps/api/src/**/!(*.integration).test.ts',
            'packages/contracts/src/**/*.test.ts',
            'packages/domain/src/**/*.test.ts',
            'packages/test-utils/src/**/*.test.ts',
          ],
          name: 'unit-node',
        },
      },
      {
        plugins: [react()],
        test: {
          environment: 'jsdom',
          include: ['apps/web/src/**/*.test.tsx'],
          name: 'unit-web',
          setupFiles: ['./apps/web/src/test/setup.ts'],
          // jsdom com fake-indexeddb em paralelo pode ultrapassar o padrão de 5 s sem que haja
          // erro de comportamento; o limite maior evita reprovação por saturação de máquina.
          testTimeout: 15_000,
        },
      },
      {
        test: {
          environment: 'node',
          fileParallelism: false,
          include: [
            'apps/api/src/**/*.integration.test.ts',
            'packages/database/src/**/*.integration.test.ts',
          ],
          name: 'integration',
          testTimeout: 10_000,
        },
      },
    ],
  },
});
