import { historyQuerySchema } from '@torkout/contracts';
import {
  bodyMeasurements,
  habitDefinitions,
  habitEntries,
  painReports,
  workoutSessions,
  type DatabaseClient,
} from '@torkout/database';
import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { type ApiDependencies, ApiHttpError, requireAuthenticatedUser } from './auth-routes.js';
import { loadHabitDefinition } from './daily-routes.js';
import { loadSession } from './planning-routes.js';

const DAY_MS = 86_400_000;

function addDays(localDate: string, amount: number): string {
  return new Date(Date.parse(`${localDate}T00:00:00Z`) + amount * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function encodeCursor(localDate: string): string {
  return Buffer.from(localDate, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string, from: string, through: string): string {
  try {
    const localDate = Buffer.from(cursor, 'base64url').toString('utf8');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || localDate < from || localDate > through) {
      throw new Error('cursor outside requested range');
    }
    return localDate;
  } catch {
    throw new ApiHttpError(400, 'INVALID_CURSOR', 'Cursor histórico inválido.');
  }
}

function painView(row: typeof painReports.$inferSelect) {
  return {
    bodyRegion: row.bodyRegion,
    customBodyRegion: row.customBodyRegion,
    exerciseId: row.exerciseId,
    exerciseSetId: row.exerciseSetId,
    exerciseStopped: row.exerciseStopped,
    id: row.id,
    intensity: row.intensity,
    localDate: row.localDate,
    moment: row.moment,
    notes: row.notes,
    occurredAt: row.occurredAt?.toISOString() ?? null,
    sessionId: row.sessionId,
    type: row.type,
    version: row.version,
  };
}

function measurementView(row: typeof bodyMeasurements.$inferSelect) {
  return {
    id: row.id,
    localDate: row.localDate,
    measuredAt: row.measuredAt.toISOString(),
    notes: row.notes,
    version: row.version,
    waistCm: row.waistCm === null ? null : Number(row.waistCm),
    weightKg: row.weightKg === null ? null : Number(row.weightKg),
  };
}

function habitEntryView(row: typeof habitEntries.$inferSelect) {
  return {
    booleanValue: row.booleanValue,
    habitDefinitionId: row.habitDefinitionId,
    id: row.id,
    localDate: row.localDate,
    notes: row.notes,
    numericValue: row.numericValue === null ? null : Number(row.numericValue),
    selectedOptionId: row.selectedOptionId,
    textValue: row.textValue,
    version: row.version,
  };
}

async function loadHabits(database: DatabaseClient, userId: string) {
  const ids = await database
    .select({ id: habitDefinitions.id })
    .from(habitDefinitions)
    .where(and(eq(habitDefinitions.userId, userId), isNull(habitDefinitions.deletedAt)))
    .orderBy(asc(habitDefinitions.sortOrder));
  return (
    await Promise.all(ids.map((row) => loadHabitDefinition(database, userId, row.id)))
  ).filter((habit) => habit !== undefined);
}

export function registerHistoryRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  app.get('/api/v1/history', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const parsed = historyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Intervalo histórico inválido.');
    }
    const query = parsed.data;
    const pageFrom = query.cursor
      ? decodeCursor(query.cursor, query.from, query.through)
      : query.from;
    const candidateThrough = addDays(pageFrom, query.limit - 1);
    const pageThrough = candidateThrough < query.through ? candidateThrough : query.through;

    const [sessionIds, painRows, habitRows, measurementRows, habits] = await Promise.all([
      dependencies.database
        .select({ id: workoutSessions.id })
        .from(workoutSessions)
        .where(
          and(
            eq(workoutSessions.userId, user.id),
            gte(workoutSessions.plannedLocalDate, pageFrom),
            lte(workoutSessions.plannedLocalDate, pageThrough),
            isNull(workoutSessions.deletedAt),
          ),
        )
        .orderBy(asc(workoutSessions.plannedLocalDate), asc(workoutSessions.suggestedLocalTime)),
      dependencies.database
        .select()
        .from(painReports)
        .where(
          and(
            eq(painReports.userId, user.id),
            gte(painReports.localDate, pageFrom),
            lte(painReports.localDate, pageThrough),
            isNull(painReports.deletedAt),
          ),
        )
        .orderBy(asc(painReports.localDate), asc(painReports.createdAt)),
      dependencies.database
        .select()
        .from(habitEntries)
        .where(
          and(
            eq(habitEntries.userId, user.id),
            gte(habitEntries.localDate, pageFrom),
            lte(habitEntries.localDate, pageThrough),
            isNull(habitEntries.deletedAt),
          ),
        )
        .orderBy(asc(habitEntries.localDate), asc(habitEntries.createdAt)),
      dependencies.database
        .select()
        .from(bodyMeasurements)
        .where(
          and(
            eq(bodyMeasurements.userId, user.id),
            gte(bodyMeasurements.localDate, pageFrom),
            lte(bodyMeasurements.localDate, pageThrough),
            isNull(bodyMeasurements.deletedAt),
          ),
        )
        .orderBy(asc(bodyMeasurements.localDate), asc(bodyMeasurements.measuredAt)),
      loadHabits(dependencies.database, user.id),
    ]);
    const sessions = (
      await Promise.all(
        sessionIds.map((row) => loadSession(dependencies.database, user.id, row.id)),
      )
    ).filter((session) => session !== undefined);

    const days = [];
    for (let localDate = pageFrom; localDate <= pageThrough; localDate = addDays(localDate, 1)) {
      days.push({
        habitEntries: habitRows.filter((row) => row.localDate === localDate).map(habitEntryView),
        localDate,
        measurements: measurementRows
          .filter((row) => row.localDate === localDate)
          .map(measurementView),
        painReports: painRows.filter((row) => row.localDate === localDate).map(painView),
        sessions: sessions.filter((session) => session.plannedLocalDate === localDate),
      });
    }

    return {
      days,
      habits,
      nextCursor: pageThrough < query.through ? encodeCursor(addDays(pageThrough, 1)) : null,
    };
  });
}
