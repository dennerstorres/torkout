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
