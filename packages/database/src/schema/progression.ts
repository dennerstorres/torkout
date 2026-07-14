import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth.js';
import { syncableColumns, timestampColumns } from './common.js';
import { exercises, trainingPlans } from './training.js';

export const progressionOutcomeEnum = pgEnum('progression_outcome', [
  'eligible',
  'blocked',
  'no_change',
]);
export const progressionSuggestionTypeEnum = pgEnum('progression_suggestion_type', [
  'increase',
  'maintain',
  'reduce',
  'stop',
]);
export const progressionSuggestionStatusEnum = pgEnum('progression_suggestion_status', [
  'pending',
  'accepted',
  'ignored',
  'snoozed',
  'invalidated',
  'expired',
]);
export const progressionDecisionEnum = pgEnum('progression_decision', [
  'accepted',
  'ignored',
  'snoozed',
]);

export const progressionRuleVersions = pgTable(
  'progression_rule_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    version: text('version').notNull(),
    parameters: jsonb('parameters').$type<Record<string, unknown>>().default({}).notNull(),
    effectiveAt: timestamp('effective_at', { mode: 'date', withTimezone: true }).notNull(),
    retiredAt: timestamp('retired_at', { mode: 'date', withTimezone: true }),
    active: boolean('active').default(true).notNull(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('progression_rule_versions_code_version_unique').on(table.code, table.version),
  ],
);

export const progressionEvaluations = pgTable(
  'progression_evaluations',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ruleVersionId: uuid('rule_version_id')
      .notNull()
      .references(() => progressionRuleVersions.id, { onDelete: 'restrict' }),
    exerciseId: uuid('exercise_id').references(() => exercises.id, { onDelete: 'set null' }),
    evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull(),
    evidenceHash: text('evidence_hash').notNull(),
    outcome: progressionOutcomeEnum('outcome').notNull(),
    evaluatedAt: timestamp('evaluated_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('progression_evaluations_evidence_unique').on(
      table.userId,
      table.ruleVersionId,
      table.evidenceHash,
    ),
    index('progression_evaluations_user_id_idx').on(table.userId),
  ],
);

export const progressionSuggestions = pgTable(
  'progression_suggestions',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    evaluationId: uuid('evaluation_id')
      .notNull()
      .references(() => progressionEvaluations.id, { onDelete: 'cascade' }),
    type: progressionSuggestionTypeEnum('type').notNull(),
    proposal: jsonb('proposal').$type<Record<string, unknown>>().notNull(),
    explanation: text('explanation').notNull(),
    safetyNotice: text('safety_notice').notNull(),
    safetyNoticeVersion: text('safety_notice_version').notNull(),
    status: progressionSuggestionStatusEnum('status').default('pending').notNull(),
    validUntil: timestamp('valid_until', { mode: 'date', withTimezone: true }),
  },
  (table) => [
    uniqueIndex('progression_suggestions_evaluation_unique').on(table.evaluationId),
    index('progression_suggestions_user_status_idx').on(table.userId, table.status),
  ],
);

export const progressionDecisions = pgTable(
  'progression_decisions',
  {
    ...syncableColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    suggestionId: uuid('suggestion_id')
      .notNull()
      .references(() => progressionSuggestions.id, { onDelete: 'cascade' }),
    decision: progressionDecisionEnum('decision').notNull(),
    decidedAt: timestamp('decided_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    effectPlanId: uuid('effect_plan_id').references(() => trainingPlans.id, {
      onDelete: 'set null',
    }),
    effectEntityId: uuid('effect_entity_id'),
  },
  (table) => [
    uniqueIndex('progression_decisions_suggestion_unique').on(table.suggestionId),
    check(
      'progression_decisions_effect_check',
      sql`${table.decision} <> 'accepted' or ${table.effectEntityId} is not null`,
    ),
  ],
);
