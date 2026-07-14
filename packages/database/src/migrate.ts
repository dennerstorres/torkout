import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import type { DatabaseClient } from './client.js';

const defaultMigrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

export async function migrateDatabase(
  db: DatabaseClient,
  migrationsFolder = defaultMigrationsFolder,
): Promise<void> {
  await migrate(db, { migrationsFolder });
}
