import { DATA_EXPORT_FORMAT_VERSION, dataExportSchema, type DataExport } from '@torkout/contracts';
import {
  bodyMeasurements,
  coffeeIntakes,
  exerciseSets,
  exercises,
  habitDefinitions,
  habitEntries,
  habitOptions,
  painReports,
  privacyAcceptances,
  privacyDocuments,
  progressPhotos,
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
  wheyIntakes,
  workoutSessions,
  workoutTemplateExercises,
  workoutTemplates,
  workoutTemplateSets,
  type DatabaseClient,
} from '@torkout/database';
import { and, eq, gte, inArray, isNull, lte, or, type SQL } from 'drizzle-orm';

import { ApiHttpError } from './auth-routes.js';

export const DEFAULT_TIME_ZONE = 'America/Cuiaba';

type JsonRecord = Record<string, unknown>;

/**
 * Recorte de datas civis aplicado nas consultas. A exportação de portabilidade não usa recorte —
 * ela precisa entregar tudo. O MCP sempre usa, para que uma pergunta sobre catorze dias não carregue
 * anos de séries individuais do banco.
 */
export interface SnapshotScope {
  from: string;
  through: string;
}

export interface LoadDataSnapshotOptions {
  now?: Date;
  pendingChanges?: DataExport['pendingChanges'];
  /** Faixa informada ao relatório; não filtra consulta, apenas descreve o pedido. */
  requestedRange?: { from: string; through: string } | null;
  /** Faixa que efetivamente limita as consultas ao banco. */
  scope?: SnapshotScope | undefined;
}

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

/**
 * Restringe uma coluna de data civil ao recorte pedido. Sem recorte devolve `undefined`, e o
 * `and()` do Drizzle simplesmente ignora o termo.
 */
function withinScope(
  column: Parameters<typeof gte>[0],
  scope: SnapshotScope | undefined,
): SQL | undefined {
  if (!scope) return undefined;
  return and(gte(column, scope.from), lte(column, scope.through));
}

export async function loadDataSnapshot(
  database: DatabaseClient,
  userId: string,
  options: LoadDataSnapshotOptions = {},
): Promise<DataExport> {
  const now = options.now ?? new Date();
  const scope = options.scope;
  const pendingChanges = options.pendingChanges ?? [];

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
    painRows,
    habitDefinitionRows,
    habitOptionRows,
    habitEntryRows,
    measurementRows,
    coffeeRows,
    wheyRows,
    photoRows,
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
    database
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, userId),
          withinScope(workoutSessions.plannedLocalDate, scope),
        ),
      ),
    database
      .select()
      .from(painReports)
      .where(and(eq(painReports.userId, userId), withinScope(painReports.localDate, scope))),
    database.select().from(habitDefinitions).where(eq(habitDefinitions.userId, userId)),
    database.select().from(habitOptions).where(eq(habitOptions.userId, userId)),
    database
      .select()
      .from(habitEntries)
      .where(and(eq(habitEntries.userId, userId), withinScope(habitEntries.localDate, scope))),
    database
      .select()
      .from(bodyMeasurements)
      .where(
        and(eq(bodyMeasurements.userId, userId), withinScope(bodyMeasurements.localDate, scope)),
      ),
    database
      .select()
      .from(coffeeIntakes)
      .where(and(eq(coffeeIntakes.userId, userId), withinScope(coffeeIntakes.localDate, scope))),
    database
      .select()
      .from(wheyIntakes)
      .where(and(eq(wheyIntakes.userId, userId), withinScope(wheyIntakes.localDate, scope))),
    database
      .select({
        byteSize: progressPhotos.byteSize,
        capturedAt: progressPhotos.capturedAt,
        contentType: progressPhotos.contentType,
        createdAt: progressPhotos.createdAt,
        deletedAt: progressPhotos.deletedAt,
        heightPx: progressPhotos.heightPx,
        id: progressPhotos.id,
        localDate: progressPhotos.localDate,
        measurementId: progressPhotos.measurementId,
        notes: progressPhotos.notes,
        pose: progressPhotos.pose,
        updatedAt: progressPhotos.updatedAt,
        userId: progressPhotos.userId,
        version: progressPhotos.version,
        widthPx: progressPhotos.widthPx,
      })
      .from(progressPhotos)
      .where(and(eq(progressPhotos.userId, userId), withinScope(progressPhotos.localDate, scope))),
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

  // Filhos da sessão só são carregados para as sessões já selecionadas. Sem esse vínculo, um recorte
  // de duas semanas ainda arrastaria todas as séries já registradas pela conta.
  const sessionIds = sessionRows.map((session) => session.id);
  const [sessionExerciseRows, walkingRows] = await Promise.all([
    scope && sessionIds.length === 0
      ? Promise.resolve([])
      : database
          .select()
          .from(sessionExercises)
          .where(
            and(
              eq(sessionExercises.userId, userId),
              scope ? inArray(sessionExercises.sessionId, sessionIds) : undefined,
            ),
          ),
    scope && sessionIds.length === 0
      ? Promise.resolve([])
      : database
          .select()
          .from(walkingDetails)
          .where(
            and(
              eq(walkingDetails.userId, userId),
              scope ? inArray(walkingDetails.sessionId, sessionIds) : undefined,
            ),
          ),
  ]);

  const sessionExerciseIds = sessionExerciseRows.map((exercise) => exercise.id);
  const setRows =
    scope && sessionExerciseIds.length === 0
      ? []
      : await database
          .select()
          .from(exerciseSets)
          .where(
            and(
              eq(exerciseSets.userId, userId),
              scope ? inArray(exerciseSets.sessionExerciseId, sessionExerciseIds) : undefined,
            ),
          );

  const ruleIds = [...new Set(evaluationRows.map((item) => item.ruleVersionId))];
  const ruleRows =
    ruleIds.length === 0
      ? []
      : await database
          .select()
          .from(progressionRuleVersions)
          .where(inArray(progressionRuleVersions.id, ruleIds));

  return dataExportSchema.parse({
    account: jsonValue(account),
    entities: {
      bodyMeasurements: rows(measurementRows),
      coffeeIntakes: rows(coffeeRows),
      exercises: rows(exerciseRows),
      exerciseSets: rows(setRows),
      habitDefinitions: rows(habitDefinitionRows),
      habitEntries: rows(habitEntryRows),
      habitOptions: rows(habitOptionRows),
      painReports: rows(painRows),
      privacyAcceptances: rows(acceptanceRows),
      progressPhotos: rows(photoRows),
      progressionDecisions: rows(decisionRows),
      progressionEvaluations: rows(evaluationRows),
      progressionRuleVersions: rows(ruleRows),
      progressionSuggestions: rows(suggestionRows),
      scheduleRules: rows(scheduleRows),
      sessionExercises: rows(sessionExerciseRows),
      trainingPlans: rows(planRows),
      userProfiles: rows(profileRows),
      walkingDetails: rows(walkingRows),
      wheyIntakes: rows(wheyRows),
      workoutSessions: rows(sessionRows),
      workoutTemplateExercises: rows(templateExerciseRows),
      workoutTemplates: rows(templateRows),
      workoutTemplateSets: rows(templateSetRows),
    },
    exportedAt: now.toISOString(),
    formatVersion: DATA_EXPORT_FORMAT_VERSION,
    pendingChanges,
    requestedRange: options.requestedRange ?? null,
    timeZone: profileRows[0]?.timeZone ?? DEFAULT_TIME_ZONE,
    units: {
      distance: 'meter',
      height: 'centimeter',
      waist: 'centimeter',
      weight: 'kilogram',
    },
  });
}
