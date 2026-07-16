import { progressAnalyticsResponseSchema, progressQuerySchema } from '@torkout/contracts';
import {
  bodyMeasurements,
  exerciseSets,
  painReports,
  sessionExercises,
  walkingDetails,
  workoutSessions,
  type DatabaseClient,
} from '@torkout/database';
import { calculateProgressAnalytics } from '@torkout/domain';
import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { type ApiDependencies, ApiHttpError, requireAuthenticatedUser } from './auth-routes.js';

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

async function loadAnalytics(
  database: DatabaseClient,
  userId: string,
  range: { from: string; through: string },
) {
  const [sessionRows, measurementRows, painRows] = await Promise.all([
    database
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, userId),
          gte(workoutSessions.plannedLocalDate, range.from),
          lte(workoutSessions.plannedLocalDate, range.through),
          isNull(workoutSessions.deletedAt),
        ),
      )
      .orderBy(asc(workoutSessions.plannedLocalDate)),
    database
      .select()
      .from(bodyMeasurements)
      .where(
        and(
          eq(bodyMeasurements.userId, userId),
          gte(bodyMeasurements.localDate, range.from),
          lte(bodyMeasurements.localDate, range.through),
          isNull(bodyMeasurements.deletedAt),
        ),
      )
      .orderBy(asc(bodyMeasurements.measuredAt)),
    database
      .select()
      .from(painReports)
      .where(
        and(
          eq(painReports.userId, userId),
          gte(painReports.localDate, range.from),
          lte(painReports.localDate, range.through),
          isNull(painReports.deletedAt),
        ),
      )
      .orderBy(asc(painReports.localDate)),
  ]);

  const sessionIds = sessionRows.map((session) => session.id);
  const exerciseRows =
    sessionIds.length === 0
      ? []
      : await database
          .select()
          .from(sessionExercises)
          .where(
            and(
              eq(sessionExercises.userId, userId),
              inArray(sessionExercises.sessionId, sessionIds),
              isNull(sessionExercises.deletedAt),
            ),
          )
          .orderBy(asc(sessionExercises.sortOrder));
  const exerciseIds = exerciseRows.map((exercise) => exercise.id);
  const [setRows, walkingRows] = await Promise.all([
    exerciseIds.length === 0
      ? Promise.resolve([])
      : database
          .select()
          .from(exerciseSets)
          .where(
            and(
              eq(exerciseSets.userId, userId),
              inArray(exerciseSets.sessionExerciseId, exerciseIds),
              isNull(exerciseSets.deletedAt),
            ),
          )
          .orderBy(asc(exerciseSets.setNumber)),
    sessionIds.length === 0
      ? Promise.resolve([])
      : database
          .select()
          .from(walkingDetails)
          .where(
            and(
              eq(walkingDetails.userId, userId),
              inArray(walkingDetails.sessionId, sessionIds),
              isNull(walkingDetails.deletedAt),
            ),
          ),
  ]);
  const exercisesBySession = groupBy(exerciseRows, (exercise) => exercise.sessionId);
  const setsByExercise = groupBy(setRows, (set) => set.sessionExerciseId);
  const walkingBySession = new Map(walkingRows.map((walking) => [walking.sessionId, walking]));

  return calculateProgressAnalytics({
    ...range,
    measurements: measurementRows.map((measurement) => ({
      localDate: measurement.localDate,
      measuredAt: measurement.measuredAt.toISOString(),
      waistCm: measurement.waistCm === null ? null : Number(measurement.waistCm),
      weightKg: measurement.weightKg === null ? null : Number(measurement.weightKg),
    })),
    painReports: painRows.map((report) => ({
      bodyRegion: report.bodyRegion,
      createdAt: report.createdAt.toISOString(),
      intensity: report.intensity,
      localDate: report.localDate,
      type: report.type,
    })),
    sessions: sessionRows.map((session) => {
      const walking = walkingBySession.get(session.id);
      return {
        exercises: (exercisesBySession.get(session.id) ?? []).map((exercise) => ({
          exerciseId: exercise.exerciseId,
          metric: exercise.trackingMetricSnapshot,
          name: exercise.exerciseNameSnapshot,
          sets: (setsByExercise.get(exercise.id) ?? []).map((set) => ({
            actualDistanceMeters:
              set.actualDistanceMeters === null ? null : Number(set.actualDistanceMeters),
            actualDurationSeconds: set.actualDurationSeconds,
            actualRepetitions: set.actualRepetitions,
          })),
          status: exercise.status,
        })),
        localDate: session.plannedLocalDate,
        status: session.status,
        type: session.type,
        walkingDistanceMeters:
          walking?.actualDistanceMeters === null || walking?.actualDistanceMeters === undefined
            ? null
            : Number(walking.actualDistanceMeters),
      };
    }),
  });
}

export function registerAnalyticsRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  app.get('/api/v1/progress', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const parsed = progressQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Intervalo de progresso inválido.');
    }
    const analytics = await loadAnalytics(dependencies.database, user.id, parsed.data);
    return progressAnalyticsResponseSchema.parse({
      ...analytics,
      range: parsed.data,
    });
  });
}
