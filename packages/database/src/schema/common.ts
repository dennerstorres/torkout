import { integer, timestamp, uuid } from 'drizzle-orm/pg-core';

export const timestampColumns = () => ({
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export const syncableColumns = () => ({
  id: uuid('id').defaultRandom().primaryKey(),
  ...timestampColumns(),
  version: integer('version').default(1).notNull(),
  deletedAt: timestamp('deleted_at', { mode: 'date', withTimezone: true }),
});
