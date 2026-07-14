import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth.js';
import { syncableColumns } from './common.js';

export const syncOperationTypeEnum = pgEnum('sync_operation_type', [
  'create',
  'update',
  'delete',
  'resolve',
]);
export const syncOperationResultEnum = pgEnum('sync_operation_result', [
  'applied',
  'duplicate',
  'rejected',
  'unauthorized',
  'conflict',
]);
export const auditActorTypeEnum = pgEnum('audit_actor_type', ['user', 'admin', 'system']);

export const registeredDevices = pgTable(
  'registered_devices',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceKeyHash: text('device_key_hash').notNull(),
    displayName: text('display_name'),
    platform: text('platform'),
    lastSyncedAt: timestamp('last_synced_at', { mode: 'date', withTimezone: true }),
    offlineAuthorizedUntil: timestamp('offline_authorized_until', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex('registered_devices_user_key_unique').on(table.userId, table.deviceKeyHash),
    check(
      'registered_devices_offline_window_check',
      sql`${table.offlineAuthorizedUntil} <= ${table.createdAt} + interval '30 days'`,
    ),
  ],
);

export const syncOperations = pgTable(
  'sync_operations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => registeredDevices.id, { onDelete: 'cascade' }),
    operationId: uuid('operation_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    operation: syncOperationTypeEnum('operation').notNull(),
    baseVersion: integer('base_version'),
    result: syncOperationResultEnum('result').notNull(),
    errorCode: text('error_code'),
    clientOccurredAt: timestamp('client_occurred_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    processedAt: timestamp('processed_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('sync_operations_user_operation_unique').on(table.userId, table.operationId),
    index('sync_operations_device_idx').on(table.deviceId, table.processedAt),
    check(
      'sync_operations_base_version_check',
      sql`${table.baseVersion} is null or ${table.baseVersion} > 0`,
    ),
  ],
);

export const changeLog = pgTable(
  'change_log',
  {
    sequence: bigserial('sequence', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    version: integer('version').notNull(),
    operation: syncOperationTypeEnum('operation').notNull(),
    changedAt: timestamp('changed_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { mode: 'date', withTimezone: true }),
  },
  (table) => [
    index('change_log_user_sequence_idx').on(table.userId, table.sequence),
    check('change_log_version_check', sql`${table.version} > 0`),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    actorType: auditActorTypeEnum('actor_type').notNull(),
    eventType: text('event_type').notNull(),
    subjectType: text('subject_type'),
    subjectId: uuid('subject_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('audit_events_user_created_idx').on(table.userId, table.createdAt)],
);
