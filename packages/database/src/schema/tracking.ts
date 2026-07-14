import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth.js';
import { syncableColumns } from './common.js';
import { exercises, exerciseSets, workoutSessions } from './training.js';

export const painTypeEnum = pgEnum('pain_type', ['muscular', 'joint']);
export const painIntensityEnum = pgEnum('pain_intensity', [
  'not_informed',
  'light',
  'moderate',
  'strong',
]);
export const painMomentEnum = pgEnum('pain_moment', ['before', 'during', 'after', 'next_day']);
export const bodyRegionEnum = pgEnum('body_region', [
  'neck',
  'shoulder',
  'arm',
  'elbow',
  'wrist',
  'hand',
  'chest',
  'back',
  'abdomen',
  'hip',
  'thigh',
  'knee',
  'leg',
  'ankle',
  'foot',
  'other',
]);
export const habitTypeEnum = pgEnum('habit_type', ['boolean', 'quantity', 'scale', 'choice']);

export const painReports = pgTable(
  'pain_reports',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    type: painTypeEnum('type').notNull(),
    intensity: painIntensityEnum('intensity').default('not_informed').notNull(),
    moment: painMomentEnum('moment').notNull(),
    bodyRegion: bodyRegionEnum('body_region').notNull(),
    customBodyRegion: text('custom_body_region'),
    sessionId: uuid('session_id').references(() => workoutSessions.id, { onDelete: 'set null' }),
    exerciseId: uuid('exercise_id').references(() => exercises.id, { onDelete: 'set null' }),
    exerciseSetId: uuid('exercise_set_id').references(() => exerciseSets.id, {
      onDelete: 'set null',
    }),
    exerciseStopped: boolean('exercise_stopped').default(false).notNull(),
    occurredAt: timestamp('occurred_at', { mode: 'date', withTimezone: true }),
    notes: text('notes'),
  },
  (table) => [
    index('pain_reports_user_date_idx').on(table.userId, table.localDate),
    check(
      'pain_reports_custom_region_check',
      sql`(${table.bodyRegion} = 'other' and nullif(trim(${table.customBodyRegion}), '') is not null) or (${table.bodyRegion} <> 'other' and ${table.customBodyRegion} is null)`,
    ),
  ],
);

export const habitDefinitions = pgTable(
  'habit_definitions',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: habitTypeEnum('type').notNull(),
    unit: text('unit'),
    sortOrder: integer('sort_order').default(0).notNull(),
    active: boolean('active').default(true).notNull(),
  },
  (table) => [
    uniqueIndex('habit_definitions_user_name_unique')
      .on(table.userId, sql`lower(${table.name})`)
      .where(sql`${table.deletedAt} is null`),
    check('habit_definitions_sort_order_check', sql`${table.sortOrder} >= 0`),
  ],
);

export const habitOptions = pgTable(
  'habit_options',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    habitDefinitionId: uuid('habit_definition_id')
      .notNull()
      .references(() => habitDefinitions.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    stableValue: text('stable_value').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (table) => [
    uniqueIndex('habit_options_value_unique').on(table.habitDefinitionId, table.stableValue),
    check('habit_options_sort_order_check', sql`${table.sortOrder} >= 0`),
  ],
);

export const habitEntries = pgTable(
  'habit_entries',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    habitDefinitionId: uuid('habit_definition_id')
      .notNull()
      .references(() => habitDefinitions.id, { onDelete: 'cascade' }),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    booleanValue: boolean('boolean_value'),
    numericValue: numeric('numeric_value', { precision: 12, scale: 3 }),
    textValue: text('text_value'),
    selectedOptionId: uuid('selected_option_id').references(() => habitOptions.id, {
      onDelete: 'restrict',
    }),
    notes: text('notes'),
  },
  (table) => [
    uniqueIndex('habit_entries_definition_date_unique').on(
      table.userId,
      table.habitDefinitionId,
      table.localDate,
    ),
    check(
      'habit_entries_exactly_one_value_check',
      sql`num_nonnulls(${table.booleanValue}, ${table.numericValue}, ${table.textValue}, ${table.selectedOptionId}) = 1`,
    ),
  ],
);

export const bodyMeasurements = pgTable(
  'body_measurements',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    measuredAt: timestamp('measured_at', { mode: 'date', withTimezone: true }).notNull(),
    weightKg: numeric('weight_kg', { precision: 6, scale: 2 }),
    waistCm: numeric('waist_cm', { precision: 6, scale: 2 }),
    notes: text('notes'),
  },
  (table) => [
    index('body_measurements_user_date_idx').on(table.userId, table.localDate),
    check(
      'body_measurements_value_presence_check',
      sql`${table.weightKg} is not null or ${table.waistCm} is not null`,
    ),
    check(
      'body_measurements_plausibility_check',
      sql`(${table.weightKg} is null or (${table.weightKg} > 0 and ${table.weightKg} <= 500)) and (${table.waistCm} is null or (${table.waistCm} > 0 and ${table.waistCm} <= 500))`,
    ),
  ],
);
