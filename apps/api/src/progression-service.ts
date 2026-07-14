import { progressionProposalSchema, type ProgressionDecisionCreate } from '@torkout/contracts';
import {
  exerciseSets,
  exercises,
  painReports,
  progressionDecisions,
  progressionEvaluations,
  progressionRuleVersions,
  progressionSuggestions,
  sessionExercises,
  workoutSessions,
  workoutTemplateExercises,
  workoutTemplates,
  workoutTemplateSets,
  type DatabaseClient,
} from '@torkout/database';
import {
  canonicalProgressionEvidence,
  evaluateProgression,
  PROGRESSION_SAFETY_NOTICE,
  PROGRESSION_SAFETY_NOTICE_VERSION,
  type ProgressionParameters,
  type ProgressionSessionEvidence,
} from '@torkout/domain';
import { createHash, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm';

import { ApiHttpError } from './auth-routes.js';

const DEFAULT_PARAMETERS: ProgressionParameters = {
  maximumRepetitions: 30,
  minimumPainFreeSessions: 2,
  minimumRepetitions: 1,
};

function ruleParameters(
  value: Record<string, unknown>,
  exerciseId?: string,
): ProgressionParameters {
  const configuredLimits = value.exerciseLimits;
  const exerciseLimits =
    exerciseId && configuredLimits && typeof configuredLimits === 'object'
      ? (configuredLimits as Record<string, unknown>)[exerciseId]
      : undefined;
  const source =
    exerciseLimits && typeof exerciseLimits === 'object'
      ? { ...value, ...(exerciseLimits as Record<string, unknown>) }
      : value;
  const number = (key: keyof ProgressionParameters, fallback: number) => {
    const candidate = source[key];
    return typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0
      ? candidate
      : fallback;
  };
  return {
    maximumRepetitions: number('maximumRepetitions', DEFAULT_PARAMETERS.maximumRepetitions),
    minimumPainFreeSessions: number(
      'minimumPainFreeSessions',
      DEFAULT_PARAMETERS.minimumPainFreeSessions,
    ),
    minimumRepetitions: number('minimumRepetitions', DEFAULT_PARAMETERS.minimumRepetitions),
  };
}

async function evidenceForExercise(
  database: DatabaseClient,
  userId: string,
  exerciseId: string,
  throughDate: string,
  count: number,
): Promise<ProgressionSessionEvidence[]> {
  const rows = await database
    .select({ exercise: sessionExercises, session: workoutSessions })
    .from(sessionExercises)
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionExercises.sessionId))
    .where(
      and(
        eq(sessionExercises.userId, userId),
        eq(sessionExercises.exerciseId, exerciseId),
        inArray(workoutSessions.status, ['completed', 'partial', 'missed']),
        lte(workoutSessions.plannedLocalDate, throughDate),
        isNull(sessionExercises.deletedAt),
        isNull(workoutSessions.deletedAt),
      ),
    )
    .orderBy(desc(workoutSessions.plannedLocalDate), desc(workoutSessions.completedAt))
    .limit(count);
  if (rows.length === 0) return [];
  const sessionIds = rows.map(({ session }) => session.id);
  const exerciseRowIds = rows.map(({ exercise }) => exercise.id);
  const [sets, pains] = await Promise.all([
    database
      .select()
      .from(exerciseSets)
      .where(
        and(
          inArray(exerciseSets.sessionExerciseId, exerciseRowIds),
          eq(exerciseSets.userId, userId),
          isNull(exerciseSets.deletedAt),
        ),
      )
      .orderBy(asc(exerciseSets.setNumber)),
    database
      .select()
      .from(painReports)
      .where(
        and(
          eq(painReports.userId, userId),
          isNull(painReports.deletedAt),
          or(inArray(painReports.sessionId, sessionIds), eq(painReports.exerciseId, exerciseId)),
        ),
      ),
  ]);
  return rows.reverse().map(({ exercise, session }) => ({
    exerciseId,
    exerciseName: exercise.exerciseNameSnapshot,
    jointPainStatus: session.jointPainStatus,
    localDate: session.plannedLocalDate,
    pains: pains
      .filter(
        (pain) =>
          pain.sessionId === session.id &&
          (pain.exerciseId === null || pain.exerciseId === exerciseId),
      )
      .map((pain) => ({
        bodyRegion: pain.bodyRegion,
        exerciseId: pain.exerciseId,
        intensity: pain.intensity,
        moment: pain.moment,
        reportId: pain.id,
        type: pain.type,
      })),
    sessionExerciseId: exercise.id,
    sessionId: session.id,
    sourceTemplateExerciseId: exercise.sourceTemplateExerciseId,
    status: session.status as 'completed' | 'partial' | 'missed',
    sets: sets
      .filter((set) => set.sessionExerciseId === exercise.id)
      .map((set) => ({
        actualRepetitions: set.actualRepetitions,
        plannedRepetitions: set.plannedRepetitions,
        setNumber: set.setNumber,
      })),
  }));
}

export async function evaluateProgressionForSession(
  database: DatabaseClient,
  userId: string,
  sessionId: string,
  invalidatePending = false,
): Promise<void> {
  const [session] = await database
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)))
    .limit(1);
  if (!session || !['completed', 'partial', 'missed'].includes(session.status)) return;
  const [rule] = await database
    .select()
    .from(progressionRuleVersions)
    .where(
      and(
        eq(progressionRuleVersions.active, true),
        lte(progressionRuleVersions.effectiveAt, new Date()),
      ),
    )
    .orderBy(desc(progressionRuleVersions.effectiveAt))
    .limit(1);
  if (!rule) return;
  const defaultParameters = ruleParameters(rule.parameters);
  const exerciseRows = await database
    .select({ exerciseId: sessionExercises.exerciseId })
    .from(sessionExercises)
    .where(
      and(
        eq(sessionExercises.sessionId, sessionId),
        eq(sessionExercises.userId, userId),
        isNull(sessionExercises.deletedAt),
      ),
    );
  for (const { exerciseId } of exerciseRows) {
    if (!exerciseId) continue;
    const parameters = ruleParameters(rule.parameters, exerciseId);
    const evidence = await evidenceForExercise(
      database,
      userId,
      exerciseId,
      session.plannedLocalDate,
      Math.max(defaultParameters.minimumPainFreeSessions, parameters.minimumPainFreeSessions),
    );
    if (evidence.length === 0) continue;
    const canonical = canonicalProgressionEvidence(evidence);
    const evidenceHash = createHash('sha256').update(canonical).digest('hex');
    const result = evaluateProgression(evidence, parameters);
    await database.transaction(async (transaction) => {
      if (invalidatePending) {
        const evaluations = await transaction
          .select({ id: progressionEvaluations.id })
          .from(progressionEvaluations)
          .where(
            and(
              eq(progressionEvaluations.userId, userId),
              eq(progressionEvaluations.exerciseId, exerciseId),
            ),
          );
        if (evaluations.length > 0) {
          await transaction
            .update(progressionSuggestions)
            .set({ status: 'invalidated' })
            .where(
              and(
                eq(progressionSuggestions.userId, userId),
                eq(progressionSuggestions.status, 'pending'),
                inArray(
                  progressionSuggestions.evaluationId,
                  evaluations.map(({ id }) => id),
                ),
              ),
            );
        }
      }
      const inserted = await transaction
        .insert(progressionEvaluations)
        .values({
          evidence: JSON.parse(canonical) as Record<string, unknown>,
          evidenceHash,
          exerciseId,
          outcome: result.outcome,
          ruleVersionId: rule.id,
          userId,
        })
        .onConflictDoNothing()
        .returning({ id: progressionEvaluations.id });
      if (inserted.length === 0) return;
      const current = evidence.at(-1)!;
      const meaningfulNoChange =
        current.status === 'missed' ||
        evidence.some((item) => item.pains.some((pain) => pain.type === 'muscular'));
      if (result.outcome === 'no_change' && !meaningfulNoChange) return;
      await transaction.insert(progressionSuggestions).values({
        evaluationId: inserted[0]!.id,
        explanation: result.explanation,
        proposal: result.proposal,
        safetyNotice: PROGRESSION_SAFETY_NOTICE,
        safetyNoticeVersion: PROGRESSION_SAFETY_NOTICE_VERSION,
        type: result.suggestionType,
        userId,
      });
    });
  }
}

export async function listProgressionSuggestions(
  database: DatabaseClient,
  userId: string,
  status?: typeof progressionSuggestions.$inferSelect.status,
) {
  const rows = await database
    .select({
      evaluation: progressionEvaluations,
      exerciseName: exercises.name,
      rule: progressionRuleVersions,
      suggestion: progressionSuggestions,
    })
    .from(progressionSuggestions)
    .innerJoin(
      progressionEvaluations,
      eq(progressionEvaluations.id, progressionSuggestions.evaluationId),
    )
    .innerJoin(
      progressionRuleVersions,
      eq(progressionRuleVersions.id, progressionEvaluations.ruleVersionId),
    )
    .leftJoin(exercises, eq(exercises.id, progressionEvaluations.exerciseId))
    .where(
      and(
        eq(progressionSuggestions.userId, userId),
        isNull(progressionSuggestions.deletedAt),
        ...(status ? [eq(progressionSuggestions.status, status)] : []),
      ),
    )
    .orderBy(desc(progressionSuggestions.createdAt));
  return rows.map(({ evaluation, exerciseName, rule, suggestion }) => ({
    createdAt: suggestion.createdAt.toISOString(),
    evidence: evaluation.evidence,
    explanation: suggestion.explanation,
    exerciseName: exerciseName ?? 'Exercício removido',
    id: suggestion.id,
    outcome: evaluation.outcome,
    proposal: suggestion.proposal,
    rule: { code: rule.code, version: rule.version },
    safetyNotice: suggestion.safetyNotice,
    safetyNoticeVersion: suggestion.safetyNoticeVersion,
    status: suggestion.status,
    type: suggestion.type,
    validUntil: suggestion.validUntil?.toISOString() ?? null,
    version: suggestion.version,
  }));
}

export async function decideProgressionSuggestion(
  database: DatabaseClient,
  userId: string,
  suggestionId: string,
  input: ProgressionDecisionCreate,
) {
  return database.transaction(async (transaction) => {
    const [existing] = await transaction
      .select()
      .from(progressionDecisions)
      .where(
        and(
          eq(progressionDecisions.suggestionId, suggestionId),
          eq(progressionDecisions.userId, userId),
        ),
      )
      .limit(1);
    if (existing)
      return {
        decision: existing.decision,
        effectEntityId: existing.effectEntityId,
        id: existing.id,
      };
    const [row] = await transaction
      .select({ evaluation: progressionEvaluations, suggestion: progressionSuggestions })
      .from(progressionSuggestions)
      .innerJoin(
        progressionEvaluations,
        eq(progressionEvaluations.id, progressionSuggestions.evaluationId),
      )
      .where(
        and(
          eq(progressionSuggestions.id, suggestionId),
          eq(progressionSuggestions.userId, userId),
          eq(progressionSuggestions.status, 'pending'),
        ),
      )
      .limit(1);
    if (!row)
      throw new ApiHttpError(404, 'SUGGESTION_NOT_FOUND', 'Sugestão pendente não encontrada.');
    let effectEntityId: string | null = null;
    let effectPlanId: string | null = null;
    if (input.decision === 'accepted') {
      const proposal = progressionProposalSchema.parse(row.suggestion.proposal);
      effectEntityId = row.evaluation.exerciseId ?? randomUUID();
      if (proposal.sourceTemplateExerciseId) {
        const [templateLink] = await transaction
          .select({ planId: workoutTemplates.planId })
          .from(workoutTemplateExercises)
          .innerJoin(workoutTemplates, eq(workoutTemplates.id, workoutTemplateExercises.templateId))
          .where(
            and(
              eq(workoutTemplateExercises.id, proposal.sourceTemplateExerciseId),
              eq(workoutTemplateExercises.userId, userId),
            ),
          )
          .limit(1);
        effectPlanId = templateLink?.planId ?? null;
      }
      if (proposal.mode === 'increase_repetitions' || proposal.mode === 'reduce_repetitions') {
        const values = proposal.toRepetitions ?? [];
        if (proposal.sourceTemplateExerciseId) {
          const templateSets = await transaction
            .select()
            .from(workoutTemplateSets)
            .where(
              and(
                eq(workoutTemplateSets.templateExerciseId, proposal.sourceTemplateExerciseId),
                eq(workoutTemplateSets.userId, userId),
                isNull(workoutTemplateSets.deletedAt),
              ),
            )
            .orderBy(asc(workoutTemplateSets.setNumber));
          for (const set of templateSets) {
            const target = values[set.setNumber - 1];
            if (target !== undefined)
              await transaction
                .update(workoutTemplateSets)
                .set({ targetRepetitions: target })
                .where(eq(workoutTemplateSets.id, set.id));
          }
          effectEntityId = proposal.sourceTemplateExerciseId;
        }
        const futureSets = await transaction
          .select({ exercise: sessionExercises, session: workoutSessions, set: exerciseSets })
          .from(exerciseSets)
          .innerJoin(sessionExercises, eq(sessionExercises.id, exerciseSets.sessionExerciseId))
          .innerJoin(workoutSessions, eq(workoutSessions.id, sessionExercises.sessionId))
          .where(
            and(
              eq(exerciseSets.userId, userId),
              eq(sessionExercises.exerciseId, proposal.exerciseId),
              eq(workoutSessions.status, 'planned'),
              gt(workoutSessions.plannedLocalDate, proposal.effectiveAfter),
              isNull(exerciseSets.deletedAt),
            ),
          );
        for (const { set } of futureSets) {
          const target = values[set.setNumber - 1];
          if (target !== undefined)
            await transaction
              .update(exerciseSets)
              .set({ plannedRepetitions: target })
              .where(eq(exerciseSets.id, set.id));
        }
      }
      if (proposal.mode === 'remove_set' && proposal.sourceTemplateExerciseId) {
        const [last] = await transaction
          .select()
          .from(workoutTemplateSets)
          .where(
            and(
              eq(workoutTemplateSets.templateExerciseId, proposal.sourceTemplateExerciseId),
              isNull(workoutTemplateSets.deletedAt),
            ),
          )
          .orderBy(desc(workoutTemplateSets.setNumber))
          .limit(1);
        if (last) {
          await transaction
            .update(workoutTemplateSets)
            .set({ deletedAt: new Date() })
            .where(eq(workoutTemplateSets.id, last.id));
          effectEntityId = last.id;
        }
        const futureSets = await transaction
          .select({ sessionExerciseId: exerciseSets.sessionExerciseId, set: exerciseSets })
          .from(exerciseSets)
          .innerJoin(sessionExercises, eq(sessionExercises.id, exerciseSets.sessionExerciseId))
          .innerJoin(workoutSessions, eq(workoutSessions.id, sessionExercises.sessionId))
          .where(
            and(
              eq(exerciseSets.userId, userId),
              eq(sessionExercises.exerciseId, proposal.exerciseId),
              eq(workoutSessions.status, 'planned'),
              gt(workoutSessions.plannedLocalDate, proposal.effectiveAfter),
              isNull(exerciseSets.deletedAt),
            ),
          )
          .orderBy(desc(exerciseSets.setNumber));
        const seenExercises = new Set<string>();
        for (const { sessionExerciseId, set } of futureSets) {
          if (seenExercises.has(sessionExerciseId)) continue;
          seenExercises.add(sessionExerciseId);
          await transaction
            .update(exerciseSets)
            .set({ deletedAt: new Date() })
            .where(eq(exerciseSets.id, set.id));
        }
      }
    }
    const [decision] = await transaction
      .insert(progressionDecisions)
      .values({
        decision: input.decision,
        effectEntityId,
        effectPlanId,
        id: input.id ?? randomUUID(),
        suggestionId,
        userId,
      })
      .returning();
    await transaction
      .update(progressionSuggestions)
      .set({ status: input.decision })
      .where(eq(progressionSuggestions.id, suggestionId));
    return {
      decision: decision!.decision,
      effectEntityId: decision!.effectEntityId,
      id: decision!.id,
    };
  });
}
