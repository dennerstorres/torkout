import { defineConfig } from 'drizzle-kit';

const localDevelopmentUrl = 'postgresql://torkout:torkout_local_only@localhost:15432/torkout_test';

export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL ?? localDevelopmentUrl,
  },
  dialect: 'postgresql',
  migrations: {
    schema: 'drizzle',
    table: '__drizzle_migrations',
  },
  out: './packages/database/migrations',
  schema: './packages/database/src/schema/index.ts',
  strict: true,
  verbose: true,
});
