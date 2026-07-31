import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
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
import { syncableColumns } from './common.js';
import { exercises, exerciseSets, workoutSessions } from './training.js';

export const painTypeEnum = pgEnum('pain_type', ['muscular', 'joint', 'other']);
export const coffeeStatusEnum = pgEnum('coffee_status', [
  'not_consumed',
  'without_sugar',
  'with_sugar',
]);
export const wheyMixBaseEnum = pgEnum('whey_mix_base', [
  'water',
  'whole_milk',
  'semi_skimmed_milk',
  'skimmed_milk',
  'other',
]);
export const wheyMomentEnum = pgEnum('whey_moment', [
  'morning',
  'pre_workout',
  'post_workout',
  'night',
  'other',
]);
export const wheyToleranceEnum = pgEnum('whey_tolerance', [
  'none',
  'gas',
  'bloating',
  'cramp',
  'diarrhea',
  'nausea',
  'other',
]);
export const progressPhotoPoseEnum = pgEnum('progress_photo_pose', ['front', 'side', 'back']);
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
    intensityScore: integer('intensity_score'),
    swelling: boolean('swelling'),
    supportDifficulty: boolean('support_difficulty'),
    notes: text('notes'),
  },
  (table) => [
    index('pain_reports_user_date_idx').on(table.userId, table.localDate),
    check(
      'pain_reports_custom_region_check',
      sql`(${table.bodyRegion} = 'other' and nullif(trim(${table.customBodyRegion}), '') is not null) or (${table.bodyRegion} <> 'other' and ${table.customBodyRegion} is null)`,
    ),
    check(
      'pain_reports_intensity_score_check',
      sql`${table.intensityScore} is null or (${table.intensityScore} between 0 and 10)`,
    ),
  ],
);

/**
 * Consumo de café com estado explícito. Um dia sem linha significa ausência de registro, nunca
 * "não consumi".
 */
export const coffeeIntakes = pgTable(
  'coffee_intakes',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    status: coffeeStatusEnum('status').notNull(),
    recordedAt: timestamp('recorded_at', { mode: 'date', withTimezone: true }),
    notes: text('notes'),
  },
  (table) => [
    uniqueIndex('coffee_intakes_user_date_unique')
      .on(table.userId, table.localDate)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const wheyIntakes = pgTable(
  'whey_intakes',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    localTime: time('local_time'),
    consumed: boolean('consumed').notNull(),
    powderGrams: numeric('powder_grams', { precision: 7, scale: 2 }),
    servings: numeric('servings', { precision: 5, scale: 2 }),
    proteinPerServingGrams: numeric('protein_per_serving_grams', { precision: 6, scale: 2 }),
    mixedWith: wheyMixBaseEnum('mixed_with'),
    customMixedWith: text('custom_mixed_with'),
    liquidMl: numeric('liquid_ml', { precision: 8, scale: 2 }),
    brand: text('brand'),
    product: text('product'),
    moment: wheyMomentEnum('moment'),
    tolerance: wheyToleranceEnum('tolerance').array().default([]).notNull(),
    notes: text('notes'),
  },
  (table) => [
    index('whey_intakes_user_date_idx').on(table.userId, table.localDate),
    check(
      'whey_intakes_custom_mix_check',
      sql`(${table.mixedWith} = 'other' and nullif(trim(${table.customMixedWith}), '') is not null) or (${table.mixedWith} is distinct from 'other' and ${table.customMixedWith} is null)`,
    ),
    check(
      'whey_intakes_not_consumed_check',
      sql`${table.consumed} or num_nonnulls(${table.powderGrams}, ${table.servings}, ${table.proteinPerServingGrams}, ${table.mixedWith}, ${table.liquidMl}, ${table.moment}) = 0`,
    ),
    check(
      'whey_intakes_tolerance_check',
      sql`not ('none' = any(${table.tolerance})) or cardinality(${table.tolerance}) = 1`,
    ),
    check(
      'whey_intakes_values_check',
      sql`coalesce(${table.powderGrams}, 0) >= 0 and coalesce(${table.servings}, 0) >= 0 and coalesce(${table.proteinPerServingGrams}, 0) >= 0 and coalesce(${table.liquidMl}, 0) >= 0`,
    ),
  ],
);

/**
 * Apenas metadados ficam no PostgreSQL. O binário vive no storage configurado e é servido somente
 * por rota autenticada.
 */
export const progressPhotos = pgTable(
  'progress_photos',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    capturedAt: timestamp('captured_at', { mode: 'date', withTimezone: true }),
    pose: progressPhotoPoseEnum('pose').notNull(),
    storageKey: text('storage_key').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    widthPx: integer('width_px'),
    heightPx: integer('height_px'),
    measurementId: uuid('measurement_id').references(() => bodyMeasurements.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
  },
  (table) => [
    index('progress_photos_user_date_idx').on(table.userId, table.localDate),
    uniqueIndex('progress_photos_storage_key_unique').on(table.storageKey),
    check('progress_photos_byte_size_check', sql`${table.byteSize} > 0`),
    check(
      'progress_photos_dimension_check',
      sql`(${table.widthPx} is null or ${table.widthPx} > 0) and (${table.heightPx} is null or ${table.heightPx} > 0)`,
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
    additionalMeasurements: jsonb('additional_measurements')
      .$type<Array<{ key: string; label: string; unit: string; value: number }>>()
      .default([])
      .notNull(),
    weightKg: numeric('weight_kg', { precision: 6, scale: 2 }),
    waistCm: numeric('waist_cm', { precision: 6, scale: 2 }),
    // Barriga é medida separada da cintura e ganhou coluna própria para não se confundir com ela.
    abdomenCm: numeric('abdomen_cm', { precision: 6, scale: 2 }),
    fasting: boolean('fasting'),
    notes: text('notes'),
  },
  (table) => [
    index('body_measurements_user_date_idx').on(table.userId, table.localDate),
    check(
      'body_measurements_value_presence_check',
      sql`${table.weightKg} is not null or ${table.waistCm} is not null or ${table.abdomenCm} is not null or jsonb_array_length(${table.additionalMeasurements}) > 0`,
    ),
    check(
      'body_measurements_plausibility_check',
      sql`(${table.weightKg} is null or (${table.weightKg} > 0 and ${table.weightKg} <= 500)) and (${table.waistCm} is null or (${table.waistCm} > 0 and ${table.waistCm} <= 500)) and (${table.abdomenCm} is null or (${table.abdomenCm} > 0 and ${table.abdomenCm} <= 500))`,
    ),
  ],
);
