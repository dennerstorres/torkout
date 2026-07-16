import {
  DATA_EXPORT_FORMAT_VERSION,
  dataExportRequestSchema,
  dataExportSchema,
  type DataExport,
} from '@torkout/contracts';
import {
  bodyMeasurements,
  exerciseSets,
  exercises,
  habitDefinitions,
  habitEntries,
  habitOptions,
  painReports,
  privacyAcceptances,
  privacyDocuments,
  progressionDecisions,
  progressionEvaluations,
  progressionRuleVersions,
  progressionSuggestions,
  scheduleRules,
  sessionExercises,
  trainingPlans,
  userProfiles,
  users,
  walkingDetails,
  workoutSessions,
  workoutTemplateExercises,
  workoutTemplates,
  workoutTemplateSets,
  type DatabaseClient,
} from '@torkout/database';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { type ApiDependencies, ApiHttpError, requireAuthenticatedUser } from './auth-routes.js';
import { buildCsvZip } from './export-package.js';
import { buildEvolutionReport } from './evolution-report.js';

type JsonRecord = Record<string, unknown>;

function jsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, jsonValue(nested)]),
    );
  }
  return value;
}

function rows(values: unknown[]): JsonRecord[] {
  return values.map((value) => jsonValue(value) as JsonRecord);
}

async function loadExport(
  database: DatabaseClient,
  userId: string,
  pendingChanges: DataExport['pendingChanges'],
  now = new Date(),
): Promise<DataExport> {
  const [account] = await database
    .select({
      createdAt: users.createdAt,
      email: users.email,
      emailVerified: users.emailVerified,
      id: users.id,
      name: users.name,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!account) throw new ApiHttpError(404, 'ACCOUNT_NOT_FOUND', 'Conta não encontrada.');

  const [
    profileRows,
    exerciseRows,
    planRows,
    templateRows,
    templateExerciseRows,
    templateSetRows,
    scheduleRows,
    sessionRows,
    sessionExerciseRows,
    setRows,
    walkingRows,
    painRows,
    habitDefinitionRows,
    habitOptionRows,
    habitEntryRows,
    measurementRows,
    acceptanceRows,
    evaluationRows,
    suggestionRows,
    decisionRows,
  ] = await Promise.all([
    database.select().from(userProfiles).where(eq(userProfiles.userId, userId)),
    database
      .select()
      .from(exercises)
      .where(or(eq(exercises.userId, userId), isNull(exercises.userId))),
    database.select().from(trainingPlans).where(eq(trainingPlans.userId, userId)),
    database.select().from(workoutTemplates).where(eq(workoutTemplates.userId, userId)),
    database
      .select()
      .from(workoutTemplateExercises)
      .where(eq(workoutTemplateExercises.userId, userId)),
    database.select().from(workoutTemplateSets).where(eq(workoutTemplateSets.userId, userId)),
    database.select().from(scheduleRules).where(eq(scheduleRules.userId, userId)),
    database.select().from(workoutSessions).where(eq(workoutSessions.userId, userId)),
    database.select().from(sessionExercises).where(eq(sessionExercises.userId, userId)),
    database.select().from(exerciseSets).where(eq(exerciseSets.userId, userId)),
    database.select().from(walkingDetails).where(eq(walkingDetails.userId, userId)),
    database.select().from(painReports).where(eq(painReports.userId, userId)),
    database.select().from(habitDefinitions).where(eq(habitDefinitions.userId, userId)),
    database.select().from(habitOptions).where(eq(habitOptions.userId, userId)),
    database.select().from(habitEntries).where(eq(habitEntries.userId, userId)),
    database.select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, userId)),
    database
      .select({
        acceptedAt: privacyAcceptances.acceptedAt,
        createdAt: privacyAcceptances.createdAt,
        deletedAt: privacyAcceptances.deletedAt,
        documentId: privacyAcceptances.documentId,
        documentType: privacyDocuments.type,
        documentVersion: privacyDocuments.version,
        id: privacyAcceptances.id,
        updatedAt: privacyAcceptances.updatedAt,
        userId: privacyAcceptances.userId,
        version: privacyAcceptances.version,
      })
      .from(privacyAcceptances)
      .innerJoin(privacyDocuments, eq(privacyDocuments.id, privacyAcceptances.documentId))
      .where(eq(privacyAcceptances.userId, userId)),
    database
      .select({
        createdAt: progressionEvaluations.createdAt,
        deletedAt: progressionEvaluations.deletedAt,
        evaluatedAt: progressionEvaluations.evaluatedAt,
        evidence: progressionEvaluations.evidence,
        exerciseId: progressionEvaluations.exerciseId,
        id: progressionEvaluations.id,
        outcome: progressionEvaluations.outcome,
        ruleVersionId: progressionEvaluations.ruleVersionId,
        updatedAt: progressionEvaluations.updatedAt,
        userId: progressionEvaluations.userId,
        version: progressionEvaluations.version,
      })
      .from(progressionEvaluations)
      .where(eq(progressionEvaluations.userId, userId)),
    database.select().from(progressionSuggestions).where(eq(progressionSuggestions.userId, userId)),
    database.select().from(progressionDecisions).where(eq(progressionDecisions.userId, userId)),
  ]);

  const ruleIds = [...new Set(evaluationRows.map((item) => item.ruleVersionId))];
  const ruleRows =
    ruleIds.length === 0
      ? []
      : await database
          .select()
          .from(progressionRuleVersions)
          .where(and(inArray(progressionRuleVersions.id, ruleIds)));

  return dataExportSchema.parse({
    account: jsonValue(account),
    entities: {
      bodyMeasurements: rows(measurementRows),
      exercises: rows(exerciseRows),
      exerciseSets: rows(setRows),
      habitDefinitions: rows(habitDefinitionRows),
      habitEntries: rows(habitEntryRows),
      habitOptions: rows(habitOptionRows),
      painReports: rows(painRows),
      privacyAcceptances: rows(acceptanceRows),
      progressionDecisions: rows(decisionRows),
      progressionEvaluations: rows(evaluationRows),
      progressionRuleVersions: rows(ruleRows),
      progressionSuggestions: rows(suggestionRows),
      scheduleRules: rows(scheduleRows),
      sessionExercises: rows(sessionExerciseRows),
      trainingPlans: rows(planRows),
      userProfiles: rows(profileRows),
      walkingDetails: rows(walkingRows),
      workoutSessions: rows(sessionRows),
      workoutTemplateExercises: rows(templateExerciseRows),
      workoutTemplates: rows(templateRows),
      workoutTemplateSets: rows(templateSetRows),
    },
    exportedAt: now.toISOString(),
    formatVersion: DATA_EXPORT_FORMAT_VERSION,
    pendingChanges,
    timeZone: profileRows[0]?.timeZone ?? 'America/Cuiaba',
    units: {
      distance: 'meter',
      height: 'centimeter',
      waist: 'centimeter',
      weight: 'kilogram',
    },
  });
}

export function registerPortabilityRoutes(
  app: FastifyInstance,
  dependencies: ApiDependencies,
): void {
  app.post('/api/v1/exports', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const parsed = dataExportRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Pedido de exportação inválido.');
    }
    const generatedAt = new Date();
    const data = await loadExport(
      dependencies.database,
      user.id,
      parsed.data.pendingChanges,
      generatedAt,
    );
    const date = generatedAt.toISOString().slice(0, 10);
    if (parsed.data.format === 'json') {
      return reply
        .header('content-disposition', `attachment; filename="torkout-export-${date}.json"`)
        .send(data);
    }
    if (parsed.data.format === 'markdown') {
      return reply
        .type('text/markdown; charset=utf-8')
        .header('content-disposition', 'attachment; filename="RELATORIO_EVOLUCAO.md"')
        .send(buildEvolutionReport(data));
    }
    return reply
      .type('application/zip')
      .header('content-disposition', `attachment; filename="torkout-export-${date}.zip"`)
      .send(buildCsvZip(data, generatedAt));
  });
}
