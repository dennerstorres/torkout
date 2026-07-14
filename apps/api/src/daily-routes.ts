import {
  bodyMeasurementCreatePayloadSchema,
  dailyImportSchema,
  habitDefinitionCreateSchema,
  habitDefinitionUpdateSchema,
  habitEntryValueSchema,
  painReportCreateSchema,
  painReportUpdateSchema,
  workoutSessionUpdateSchema,
  SYSTEM_EXERCISES,
  type HabitDefinitionCreate,
} from '@torkout/contracts';
import {
  bodyMeasurements,
  exerciseSets,
  habitDefinitions,
  habitEntries,
  habitOptions,
  painReports,
  sessionExercises,
  workoutSessions,
  type DatabaseClient,
} from '@torkout/database';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ApiHttpError, type ApiDependencies, requireAuthenticatedUser } from './auth-routes.js';
import { applySessionExecution } from './planning-routes.js';
import { evaluateProgressionForSession } from './progression-service.js';

const idParamsSchema = z.strictObject({ id: z.uuid() });
const dateQuerySchema = z.strictObject({ localDate: z.iso.date() });
const habitEntryParamsSchema = z.strictObject({ id: z.uuid(), localDate: z.iso.date() });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Dados inválidos.');
  return result.data;
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

export async function loadHabitDefinition(database: DatabaseClient, userId: string, id: string) {
  const [definition] = await database
    .select()
    .from(habitDefinitions)
    .where(
      and(
        eq(habitDefinitions.id, id),
        eq(habitDefinitions.userId, userId),
        isNull(habitDefinitions.deletedAt),
      ),
    )
    .limit(1);
  if (!definition) return undefined;
  const options = await database
    .select()
    .from(habitOptions)
    .where(
      and(
        eq(habitOptions.habitDefinitionId, id),
        eq(habitOptions.userId, userId),
        isNull(habitOptions.deletedAt),
      ),
    )
    .orderBy(asc(habitOptions.sortOrder));
  return {
    active: definition.active,
    id: definition.id,
    name: definition.name,
    options: options.map((option) => ({
      id: option.id,
      label: option.label,
      sortOrder: option.sortOrder,
      stableValue: option.stableValue,
    })),
    sortOrder: definition.sortOrder,
    type: definition.type,
    unit: definition.unit,
    version: definition.version,
  };
}

export async function insertHabitDefinition(
  database: DatabaseClient,
  userId: string,
  input: HabitDefinitionCreate,
  id: string,
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.insert(habitDefinitions).values({
      active: input.active,
      id,
      name: input.name,
      sortOrder: input.sortOrder,
      type: input.type,
      unit: input.unit ?? null,
      userId,
    });
    if (input.options.length > 0) {
      await transaction.insert(habitOptions).values(
        input.options.map((option) => ({
          habitDefinitionId: id,
          id: option.id ?? randomUUID(),
          label: option.label,
          sortOrder: option.sortOrder,
          stableValue: option.stableValue,
          userId,
        })),
      );
    }
  });
}

async function validatePainLinks(
  database: DatabaseClient,
  userId: string,
  input: {
    exerciseSetId?: string | null | undefined;
    sessionId?: string | null | undefined;
  },
): Promise<void> {
  if (input.sessionId) {
    const [session] = await database
      .select({ id: workoutSessions.id })
      .from(workoutSessions)
      .where(and(eq(workoutSessions.id, input.sessionId), eq(workoutSessions.userId, userId)))
      .limit(1);
    if (!session) throw new ApiHttpError(400, 'INVALID_SESSION_LINK', 'Sessão inválida.');
  }
  if (input.exerciseSetId) {
    const [set] = await database
      .select({ id: exerciseSets.id })
      .from(exerciseSets)
      .where(and(eq(exerciseSets.id, input.exerciseSetId), eq(exerciseSets.userId, userId)))
      .limit(1);
    if (!set) throw new ApiHttpError(400, 'INVALID_SET_LINK', 'Série inválida.');
  }
}

export function registerDailyRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  app.put('/api/v1/sessions/:id/execution', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const input = parse(workoutSessionUpdateSchema, request.body);
    if (!input.execution) throw new ApiHttpError(400, 'EXECUTION_REQUIRED', 'Informe a execução.');
    const session = await applySessionExecution(dependencies.database, user.id, id, {
      execution: input.execution,
      notes: input.notes,
      version: input.version,
    });
    await evaluateProgressionForSession(dependencies.database, user.id, id);
    return session;
  });

  app.get('/api/v1/pain-reports', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { localDate } = parse(dateQuerySchema, request.query);
    const rows = await dependencies.database
      .select()
      .from(painReports)
      .where(
        and(
          eq(painReports.userId, user.id),
          eq(painReports.localDate, localDate),
          isNull(painReports.deletedAt),
        ),
      )
      .orderBy(asc(painReports.createdAt));
    return { items: rows.map(painView) };
  });

  app.post('/api/v1/pain-reports', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const input = parse(painReportCreateSchema, request.body);
    await validatePainLinks(dependencies.database, user.id, input);
    const [created] = await dependencies.database
      .insert(painReports)
      .values({
        ...input,
        customBodyRegion: input.customBodyRegion ?? null,
        exerciseId: input.exerciseId ?? null,
        exerciseSetId: input.exerciseSetId ?? null,
        id: input.id ?? randomUUID(),
        notes: input.notes ?? null,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
        sessionId: input.sessionId ?? null,
        userId: user.id,
      })
      .returning();
    if (!created) throw new Error('Pain report insert did not return a row.');
    if (created.sessionId) {
      await evaluateProgressionForSession(dependencies.database, user.id, created.sessionId, true);
    }
    return reply.status(201).send(painView(created));
  });

  app.put('/api/v1/pain-reports/:id', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const input = parse(painReportUpdateSchema, request.body);
    await validatePainLinks(dependencies.database, user.id, input);
    const [updated] = await dependencies.database
      .update(painReports)
      .set({ ...input, occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined })
      .where(and(eq(painReports.id, id), eq(painReports.userId, user.id)))
      .returning();
    if (!updated) throw new ApiHttpError(404, 'PAIN_REPORT_NOT_FOUND', 'Relato não encontrado.');
    if (updated.sessionId) {
      await evaluateProgressionForSession(dependencies.database, user.id, updated.sessionId, true);
    }
    return painView(updated);
  });

  app.get('/api/v1/habits', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const ids = await dependencies.database
      .select({ id: habitDefinitions.id })
      .from(habitDefinitions)
      .where(and(eq(habitDefinitions.userId, user.id), isNull(habitDefinitions.deletedAt)))
      .orderBy(asc(habitDefinitions.sortOrder));
    return {
      items: (
        await Promise.all(
          ids.map((row) => loadHabitDefinition(dependencies.database, user.id, row.id)),
        )
      ).filter(Boolean),
    };
  });

  app.post('/api/v1/habits', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const input = parse(habitDefinitionCreateSchema, request.body);
    const id = input.id ?? randomUUID();
    await insertHabitDefinition(dependencies.database, user.id, input, id);
    return reply.status(201).send(await loadHabitDefinition(dependencies.database, user.id, id));
  });

  app.get('/api/v1/habits/entries', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { localDate } = parse(dateQuerySchema, request.query);
    const rows = await dependencies.database
      .select()
      .from(habitEntries)
      .where(
        and(
          eq(habitEntries.userId, user.id),
          eq(habitEntries.localDate, localDate),
          isNull(habitEntries.deletedAt),
        ),
      )
      .orderBy(asc(habitEntries.createdAt));
    return { items: rows.map(habitEntryView) };
  });

  app.put('/api/v1/habits/:id', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const input = parse(habitDefinitionUpdateSchema, request.body);
    const { options, ...changes } = input;
    const [updated] = await dependencies.database
      .update(habitDefinitions)
      .set(changes)
      .where(and(eq(habitDefinitions.id, id), eq(habitDefinitions.userId, user.id)))
      .returning();
    if (!updated) throw new ApiHttpError(404, 'HABIT_NOT_FOUND', 'Hábito não encontrado.');
    if (options) {
      await dependencies.database
        .update(habitOptions)
        .set({ deletedAt: new Date() })
        .where(and(eq(habitOptions.habitDefinitionId, id), eq(habitOptions.userId, user.id)));
      if (options.length > 0) {
        await dependencies.database.insert(habitOptions).values(
          options.map((option) => ({
            habitDefinitionId: id,
            id: option.id ?? randomUUID(),
            label: option.label,
            sortOrder: option.sortOrder,
            stableValue: option.stableValue,
            userId: user.id,
          })),
        );
      }
    }
    return loadHabitDefinition(dependencies.database, user.id, id);
  });

  app.put('/api/v1/habits/:id/entries/:localDate', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const params = parse(habitEntryParamsSchema, request.params);
    const input = parse(habitEntryValueSchema, request.body);
    const definition = await loadHabitDefinition(dependencies.database, user.id, params.id);
    if (!definition) throw new ApiHttpError(404, 'HABIT_NOT_FOUND', 'Hábito não encontrado.');
    if (
      input.selectedOptionId &&
      !definition.options.some((option) => option.id === input.selectedOptionId)
    ) {
      throw new ApiHttpError(400, 'INVALID_HABIT_OPTION', 'Opção de hábito inválida.');
    }
    const valueMatchesType =
      (definition.type === 'choice' && input.selectedOptionId != null) ||
      (definition.type === 'boolean' && input.booleanValue != null) ||
      ((definition.type === 'quantity' || definition.type === 'scale') &&
        input.numericValue != null);
    if (!valueMatchesType) {
      throw new ApiHttpError(400, 'INVALID_HABIT_VALUE', 'Valor incompatível com o hábito.');
    }
    const values = {
      booleanValue: input.booleanValue ?? null,
      habitDefinitionId: params.id,
      localDate: params.localDate,
      notes: input.notes ?? null,
      numericValue: input.numericValue?.toString() ?? null,
      selectedOptionId: input.selectedOptionId ?? null,
      textValue: input.textValue ?? null,
      userId: user.id,
    };
    const [entry] = await dependencies.database
      .insert(habitEntries)
      .values({ id: randomUUID(), ...values })
      .onConflictDoUpdate({
        set: values,
        target: [habitEntries.userId, habitEntries.habitDefinitionId, habitEntries.localDate],
      })
      .returning();
    if (!entry) throw new Error('Habit entry upsert did not return a row.');
    return habitEntryView(entry);
  });

  app.get('/api/v1/measurements', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { localDate } = parse(dateQuerySchema, request.query);
    const rows = await dependencies.database
      .select()
      .from(bodyMeasurements)
      .where(
        and(
          eq(bodyMeasurements.userId, user.id),
          eq(bodyMeasurements.localDate, localDate),
          isNull(bodyMeasurements.deletedAt),
        ),
      )
      .orderBy(asc(bodyMeasurements.measuredAt));
    return { items: rows.map(measurementView) };
  });

  app.post('/api/v1/measurements', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const input = parse(bodyMeasurementCreatePayloadSchema, request.body);
    const [created] = await dependencies.database
      .insert(bodyMeasurements)
      .values({
        localDate: input.localDate,
        measuredAt: new Date(input.measuredAt),
        notes: input.notes ?? null,
        userId: user.id,
        waistCm: input.waistCm?.toString() ?? null,
        weightKg: input.weightKg?.toString() ?? null,
      })
      .returning();
    if (!created) throw new Error('Measurement insert did not return a row.');
    return reply.status(201).send(measurementView(created));
  });

  app.post('/api/v1/daily-history/import', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const input = parse(dailyImportSchema, request.body);
    const [existing] = await dependencies.database
      .select({ id: workoutSessions.id })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, user.id),
          eq(workoutSessions.importKey, 'history-2026-07-13'),
          isNull(workoutSessions.deletedAt),
        ),
      )
      .limit(1);
    if (existing) return { created: false, painReports: 2, sessionId: existing.id };

    const sessionId = randomUUID();
    await dependencies.database.transaction(async (transaction) => {
      await transaction.insert(workoutSessions).values({
        completedAt: new Date('2026-07-14T00:00:00.000Z'),
        importKey: 'history-2026-07-13',
        jointPainStatus: 'reported',
        plannedLocalDate: input.localDate,
        source: 'ad_hoc',
        startedAt: new Date('2026-07-13T22:00:00.000Z'),
        status: 'partial',
        templateNameSnapshot: 'Histórico de 13/07/2026',
        timeZone: 'America/Cuiaba',
        type: 'strength',
        userId: user.id,
        id: sessionId,
      });
      const definitions = [
        { exerciseId: SYSTEM_EXERCISES.pushUp.id, name: 'Flexão', repetitions: 12, stopped: false },
        {
          exerciseId: SYSTEM_EXERCISES.squat.id,
          name: 'Agachamento livre',
          repetitions: 15,
          stopped: true,
        },
      ];
      const insertedExercises: Array<{ exerciseId: string; id: string; setIds: string[] }> = [];
      for (const [sortOrder, definition] of definitions.entries()) {
        const exerciseId = randomUUID();
        await transaction.insert(sessionExercises).values({
          exerciseId: definition.exerciseId,
          exerciseNameSnapshot: definition.name,
          id: exerciseId,
          sessionId,
          sortOrder,
          status: definition.stopped ? 'stopped' : 'completed',
          trackingMetricSnapshot: 'repetitions',
          userId: user.id,
        });
        const setIds = [randomUUID(), randomUUID(), randomUUID()];
        await transaction.insert(exerciseSets).values(
          setIds.map((id, index) => ({
            actualRepetitions: definition.repetitions,
            completed: !definition.stopped || index < 2,
            id,
            plannedRepetitions: definition.repetitions,
            sessionExerciseId: exerciseId,
            setNumber: index + 1,
            userId: user.id,
          })),
        );
        insertedExercises.push({ exerciseId: definition.exerciseId, id: exerciseId, setIds });
      }
      const squat = insertedExercises[1]!;
      await transaction.insert(painReports).values([
        {
          bodyRegion: 'thigh',
          exerciseStopped: false,
          intensity: 'light',
          localDate: '2026-07-14',
          moment: 'next_day',
          sessionId,
          type: 'muscular',
          userId: user.id,
        },
        {
          bodyRegion: 'ankle',
          exerciseId: squat.exerciseId,
          exerciseSetId: squat.setIds[2],
          exerciseStopped: true,
          intensity: 'moderate',
          localDate: input.localDate,
          moment: 'during',
          sessionId,
          type: 'joint',
          userId: user.id,
        },
      ]);
    });
    return reply.status(201).send({ created: true, painReports: 2, sessionId });
  });
}
