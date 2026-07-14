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
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth.js';
import { syncableColumns } from './common.js';

export const trackingMetricEnum = pgEnum('tracking_metric', [
  'repetitions',
  'duration',
  'distance',
]);
export const activityTypeEnum = pgEnum('activity_type', ['strength', 'walk', 'rest', 'other']);
export const planStatusEnum = pgEnum('plan_status', ['draft', 'active', 'archived']);
export const workoutStatusEnum = pgEnum('workout_status', [
  'planned',
  'in_progress',
  'completed',
  'partial',
  'missed',
  'cancelled',
]);
export const sessionSourceEnum = pgEnum('session_source', ['scheduled', 'ad_hoc', 'progression']);
export const sessionExerciseStatusEnum = pgEnum('session_exercise_status', [
  'planned',
  'completed',
  'skipped',
  'stopped',
]);
export const distanceSourceEnum = pgEnum('distance_source', ['manual', 'gps', 'import']);

export const exercises = pgTable(
  'exercises',
  {
    ...syncableColumns(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category').notNull(),
    trackingMetric: trackingMetricEnum('tracking_metric').notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    instructions: text('instructions'),
    active: boolean('active').default(true).notNull(),
  },
  (table) => [
    index('exercises_user_id_idx').on(table.userId),
    uniqueIndex('exercises_user_name_unique')
      .on(table.userId, sql`lower(${table.name})`)
      .where(sql`${table.userId} is not null and ${table.deletedAt} is null`),
    uniqueIndex('exercises_system_name_unique')
      .on(sql`lower(${table.name})`)
      .where(sql`${table.isSystem} = true and ${table.deletedAt} is null`),
    check(
      'exercises_ownership_check',
      sql`(${table.isSystem} = true and ${table.userId} is null) or (${table.isSystem} = false and ${table.userId} is not null)`,
    ),
  ],
);

export const trainingPlans = pgTable(
  'training_plans',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    validFrom: date('valid_from', { mode: 'string' }).notNull(),
    validUntil: date('valid_until', { mode: 'string' }),
    status: planStatusEnum('status').default('draft').notNull(),
  },
  (table) => [
    index('training_plans_user_id_idx').on(table.userId),
    check(
      'training_plans_validity_check',
      sql`${table.validUntil} is null or ${table.validUntil} >= ${table.validFrom}`,
    ),
  ],
);

export const workoutTemplates = pgTable(
  'workout_templates',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => trainingPlans.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: activityTypeEnum('type').notNull(),
    notes: text('notes'),
  },
  (table) => [index('workout_templates_plan_id_idx').on(table.planId)],
);

export const workoutTemplateExercises = pgTable(
  'workout_template_exercises',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id')
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull(),
    notes: text('notes'),
  },
  (table) => [
    uniqueIndex('workout_template_exercises_order_unique').on(table.templateId, table.sortOrder),
    check('workout_template_exercises_order_check', sql`${table.sortOrder} >= 0`),
  ],
);

export const workoutTemplateSets = pgTable(
  'workout_template_sets',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    templateExerciseId: uuid('template_exercise_id')
      .notNull()
      .references(() => workoutTemplateExercises.id, { onDelete: 'cascade' }),
    setNumber: integer('set_number').notNull(),
    targetRepetitions: integer('target_repetitions'),
    targetDurationSeconds: integer('target_duration_seconds'),
    targetDistanceMeters: numeric('target_distance_meters', { precision: 10, scale: 2 }),
  },
  (table) => [
    uniqueIndex('workout_template_sets_number_unique').on(
      table.templateExerciseId,
      table.setNumber,
    ),
    check('workout_template_sets_number_check', sql`${table.setNumber} > 0`),
    check(
      'workout_template_sets_target_check',
      sql`num_nonnulls(${table.targetRepetitions}, ${table.targetDurationSeconds}, ${table.targetDistanceMeters}) = 1`,
    ),
    check(
      'workout_template_sets_positive_check',
      sql`coalesce(${table.targetRepetitions}, 1) > 0 and coalesce(${table.targetDurationSeconds}, 1) > 0 and coalesce(${table.targetDistanceMeters}, 1) > 0`,
    ),
  ],
);

export const scheduleRules = pgTable(
  'schedule_rules',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id')
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    localTime: time('local_time').notNull(),
    timeZone: text('time_zone').notNull(),
    validFrom: date('valid_from', { mode: 'string' }).notNull(),
    validUntil: date('valid_until', { mode: 'string' }),
  },
  (table) => [
    index('schedule_rules_user_id_idx').on(table.userId),
    check('schedule_rules_weekday_check', sql`${table.weekday} between 1 and 7`),
    check(
      'schedule_rules_validity_check',
      sql`${table.validUntil} is null or ${table.validUntil} >= ${table.validFrom}`,
    ),
  ],
);

export const workoutSessions = pgTable(
  'workout_sessions',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id').references(() => workoutTemplates.id, { onDelete: 'set null' }),
    scheduleRuleId: uuid('schedule_rule_id').references(() => scheduleRules.id, {
      onDelete: 'set null',
    }),
    templateNameSnapshot: text('template_name_snapshot').notNull(),
    plannedLocalDate: date('planned_local_date', { mode: 'string' }).notNull(),
    suggestedLocalTime: time('suggested_local_time'),
    timeZone: text('time_zone').notNull(),
    type: activityTypeEnum('type').notNull(),
    status: workoutStatusEnum('status').default('planned').notNull(),
    source: sessionSourceEnum('source').notNull(),
    startedAt: timestamp('started_at', { mode: 'date', withTimezone: true }),
    completedAt: timestamp('completed_at', { mode: 'date', withTimezone: true }),
    notes: text('notes'),
  },
  (table) => [
    index('workout_sessions_user_date_idx').on(table.userId, table.plannedLocalDate),
    uniqueIndex('workout_sessions_rule_date_unique')
      .on(table.scheduleRuleId, table.plannedLocalDate)
      .where(sql`${table.scheduleRuleId} is not null and ${table.deletedAt} is null`),
    check(
      'workout_sessions_chronology_check',
      sql`${table.completedAt} is null or ${table.startedAt} is null or ${table.completedAt} >= ${table.startedAt}`,
    ),
  ],
);

export const sessionExercises = pgTable(
  'session_exercises',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id').references(() => exercises.id, { onDelete: 'set null' }),
    sourceTemplateExerciseId: uuid('source_template_exercise_id').references(
      () => workoutTemplateExercises.id,
      { onDelete: 'set null' },
    ),
    exerciseNameSnapshot: text('exercise_name_snapshot').notNull(),
    trackingMetricSnapshot: trackingMetricEnum('tracking_metric_snapshot').notNull(),
    sortOrder: integer('sort_order').notNull(),
    status: sessionExerciseStatusEnum('status').default('planned').notNull(),
    notes: text('notes'),
  },
  (table) => [
    uniqueIndex('session_exercises_order_unique').on(table.sessionId, table.sortOrder),
    check('session_exercises_order_check', sql`${table.sortOrder} >= 0`),
  ],
);

export const exerciseSets = pgTable(
  'exercise_sets',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionExerciseId: uuid('session_exercise_id')
      .notNull()
      .references(() => sessionExercises.id, { onDelete: 'cascade' }),
    setNumber: integer('set_number').notNull(),
    plannedRepetitions: integer('planned_repetitions'),
    actualRepetitions: integer('actual_repetitions'),
    plannedDurationSeconds: integer('planned_duration_seconds'),
    actualDurationSeconds: integer('actual_duration_seconds'),
    plannedDistanceMeters: numeric('planned_distance_meters', { precision: 10, scale: 2 }),
    actualDistanceMeters: numeric('actual_distance_meters', { precision: 10, scale: 2 }),
    completed: boolean('completed').default(false).notNull(),
  },
  (table) => [
    uniqueIndex('exercise_sets_number_unique').on(table.sessionExerciseId, table.setNumber),
    check('exercise_sets_number_check', sql`${table.setNumber} > 0`),
    check(
      'exercise_sets_values_check',
      sql`coalesce(${table.plannedRepetitions}, 0) >= 0 and coalesce(${table.actualRepetitions}, 0) >= 0 and coalesce(${table.plannedDurationSeconds}, 0) >= 0 and coalesce(${table.actualDurationSeconds}, 0) >= 0 and coalesce(${table.plannedDistanceMeters}, 0) >= 0 and coalesce(${table.actualDistanceMeters}, 0) >= 0`,
    ),
  ],
);

export const walkingDetails = pgTable(
  'walking_details',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    plannedDistanceMeters: numeric('planned_distance_meters', { precision: 10, scale: 2 }),
    actualDistanceMeters: numeric('actual_distance_meters', { precision: 10, scale: 2 }),
    durationSeconds: integer('duration_seconds'),
    distanceSource: distanceSourceEnum('distance_source').default('manual').notNull(),
  },
  (table) => [
    uniqueIndex('walking_details_session_unique').on(table.sessionId),
    check(
      'walking_details_values_check',
      sql`coalesce(${table.plannedDistanceMeters}, 0) >= 0 and coalesce(${table.actualDistanceMeters}, 0) >= 0 and coalesce(${table.durationSeconds}, 0) >= 0`,
    ),
  ],
);
