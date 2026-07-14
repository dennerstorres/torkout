import { createDatabaseClient } from './client.js';
import { migrateDatabase } from './migrate.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to run database migrations.');
}

const { db, pool } = createDatabaseClient(connectionString);

try {
  await migrateDatabase(db);
} finally {
  await pool.end();
}
