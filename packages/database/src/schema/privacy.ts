import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth.js';
import { syncableColumns, timestampColumns } from './common.js';

export const privacyDocumentTypeEnum = pgEnum('privacy_document_type', [
  'privacy_notice',
  'terms',
  'health_data_consent',
]);
export const unitSystemEnum = pgEnum('unit_system', ['metric']);

export const userProfiles = pgTable(
  'user_profiles',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    heightCm: numeric('height_cm', { precision: 5, scale: 2 }),
    timeZone: text('time_zone').default('America/Cuiaba').notNull(),
    locale: text('locale').default('pt-BR').notNull(),
    weekStartsOn: integer('week_starts_on').default(1).notNull(),
    preferredWorkoutTime: time('preferred_workout_time'),
    unitSystem: unitSystemEnum('unit_system').default('metric').notNull(),
    // Objetivo declarado pelo usuário, em texto livre; usado apenas para contextualizar relatórios.
    goal: text('goal'),
  },
  (table) => [
    uniqueIndex('user_profiles_user_id_unique').on(table.userId),
    check(
      'user_profiles_height_cm_check',
      sql`${table.heightCm} is null or (${table.heightCm} > 0 and ${table.heightCm} <= 300)`,
    ),
    check('user_profiles_week_starts_on_check', sql`${table.weekStartsOn} between 0 and 6`),
  ],
);

export const privacyDocuments = pgTable(
  'privacy_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: privacyDocumentTypeEnum('type').notNull(),
    version: text('version').notNull(),
    contentHash: text('content_hash').notNull(),
    effectiveAt: timestamp('effective_at', { mode: 'date', withTimezone: true }).notNull(),
    retiredAt: timestamp('retired_at', { mode: 'date', withTimezone: true }),
    ...timestampColumns(),
  },
  (table) => [uniqueIndex('privacy_documents_type_version_unique').on(table.type, table.version)],
);

export const privacyAcceptances = pgTable(
  'privacy_acceptances',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => privacyDocuments.id, { onDelete: 'restrict' }),
    acceptedAt: timestamp('accepted_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
    ipAddressHash: text('ip_address_hash'),
    userAgentFamily: text('user_agent_family'),
  },
  (table) => [
    uniqueIndex('privacy_acceptances_user_document_unique').on(table.userId, table.documentId),
    index('privacy_acceptances_user_id_idx').on(table.userId),
  ],
);
