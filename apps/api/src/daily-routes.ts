import {
  bodyMeasurementCreatePayloadSchema,
  coffeeIntakeCreateSchema,
  habitDefinitionCreateSchema,
  habitDefinitionUpdateSchema,
  habitEntryValueSchema,
  painReportCreateSchema,
  painReportUpdateSchema,
  sessionRecoverySchema,
  wheyIntakeCreateSchema,
  wheyIntakeUpdateSchema,
  workoutSessionUpdateSchema,
  type HabitDefinitionCreate,
} from '@torkout/contracts';
import {
  bodyMeasurements,
  coffeeIntakes,
  exerciseSets,
  habitDefinitions,
  habitEntries,
  habitOptions,
  painReports,
  wheyIntakes,
  workoutSessions,
  type DatabaseClient,
} from '@torkout/database';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { recoveryDeservesAttention } from '@torkout/domain';

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

export function painView(row: typeof painReports.$inferSelect) {
  return {
    bodyRegion: row.bodyRegion,
    customBodyRegion: row.customBodyRegion,
    exerciseId: row.exerciseId,
    exerciseSetId: row.exerciseSetId,
    exerciseStopped: row.exerciseStopped,
    id: row.id,
    intensity: row.intensity,
    intensityScore: row.intensityScore,
    localDate: row.localDate,
    moment: row.moment,
    notes: row.notes,
    occurredAt: row.occurredAt?.toISOString() ?? null,
    sessionId: row.sessionId,
    supportDifficulty: row.supportDifficulty,
    swelling: row.swelling,
    type: row.type,
    version: row.version,
  };
}

export function measurementView(row: typeof bodyMeasurements.$inferSelect) {
  return {
    abdomenCm: row.abdomenCm === null ? null : Number(row.abdomenCm),
    additionalMeasurements: row.additionalMeasurements,
    fasting: row.fasting,
    id: row.id,
    localDate: row.localDate,
    measuredAt: row.measuredAt.toISOString(),
    notes: row.notes,
    version: row.version,
    waistCm: row.waistCm === null ? null : Number(row.waistCm),
    weightKg: row.weightKg === null ? null : Number(row.weightKg),
  };
}

export function coffeeView(row: typeof coffeeIntakes.$inferSelect) {
  return {
    id: row.id,
    localDate: row.localDate,
    notes: row.notes,
    recordedAt: row.recordedAt?.toISOString() ?? null,
    status: row.status,
    version: row.version,
  };
}

export function wheyView(row: typeof wheyIntakes.$inferSelect) {
  return {
    blendedWith: row.blendedWith,
    brand: row.brand,
    consumed: row.consumed,
    format: row.format,
    customMixedWith: row.customMixedWith,
    id: row.id,
    liquidMl: row.liquidMl === null ? null : Number(row.liquidMl),
    localDate: row.localDate,
    localTime: row.localTime?.slice(0, 5) ?? null,
    mixedWith: row.mixedWith,
    moment: row.moment,
    notes: row.notes,
    powderGrams: row.powderGrams === null ? null : Number(row.powderGrams),
    product: row.product,
    proteinPerServingGrams:
      row.proteinPerServingGrams === null ? null : Number(row.proteinPerServingGrams),
    servingUnit: row.servingUnit,
    servings: row.servings === null ? null : Number(row.servings),
    tolerance: row.tolerance,
    version: row.version,
  };
}

type WheyCreate = z.infer<typeof wheyIntakeCreateSchema>;
type WheyInput = {
  [Key in Exclude<keyof WheyCreate, 'id'>]?: WheyCreate[Key] | undefined;
};

export function wheyValues(input: WheyInput) {
  const values: Record<string, unknown> = {};
  if ('blendedWith' in input) values.blendedWith = input.blendedWith ?? null;
  if ('brand' in input) values.brand = input.brand ?? null;
  if ('consumed' in input) values.consumed = input.consumed;
  if ('customMixedWith' in input) values.customMixedWith = input.customMixedWith ?? null;
  if ('format' in input) values.format = input.format;
  if ('liquidMl' in input) values.liquidMl = input.liquidMl?.toString() ?? null;
  if ('localDate' in input) values.localDate = input.localDate;
  if ('localTime' in input) values.localTime = input.localTime ?? null;
  if ('mixedWith' in input) values.mixedWith = input.mixedWith ?? null;
  if ('moment' in input) values.moment = input.moment ?? null;
  if ('notes' in input) values.notes = input.notes ?? null;
  if ('powderGrams' in input) values.powderGrams = input.powderGrams?.toString() ?? null;
  if ('product' in input) values.product = input.product ?? null;
  if ('proteinPerServingGrams' in input)
    values.proteinPerServingGrams = input.proteinPerServingGrams?.toString() ?? null;
  if ('servingUnit' in input) values.servingUnit = input.servingUnit ?? null;
  if ('servings' in input) values.servings = input.servings?.toString() ?? null;
  if ('tolerance' in input) values.tolerance = input.tolerance ?? [];
  return values;
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

export async function reconcileHabitOptions(
  database: DatabaseClient,
  userId: string,
  habitDefinitionId: string,
  options: HabitDefinitionCreate['options'],
): Promise<void> {
  const existing = await database
    .select()
    .from(habitOptions)
    .where(
      and(eq(habitOptions.habitDefinitionId, habitDefinitionId), eq(habitOptions.userId, userId)),
    );
  const referenced = new Set(
    (
      await database
        .select({ selectedOptionId: habitEntries.selectedOptionId })
        .from(habitEntries)
        .where(
          and(
            eq(habitEntries.habitDefinitionId, habitDefinitionId),
            eq(habitEntries.userId, userId),
          ),
        )
    )
      .map((entry) => entry.selectedOptionId)
      .filter((id): id is string => id !== null),
  );
  const retainedIds = new Set<string>();
  for (const option of options) {
    const matched = option.id
      ? existing.find((candidate) => candidate.id === option.id)
      : existing.find((candidate) => candidate.stableValue === option.stableValue);
    if (option.id && !matched) {
      throw new ApiHttpError(400, 'INVALID_HABIT_OPTION', 'Opção de hábito inválida.');
    }
    if (matched) {
      retainedIds.add(matched.id);
      await database
        .update(habitOptions)
        .set({
          deletedAt: null,
          label: option.label,
          sortOrder: option.sortOrder,
          stableValue: option.stableValue,
        })
        .where(
          and(
            eq(habitOptions.id, matched.id),
            eq(habitOptions.userId, userId),
            eq(habitOptions.habitDefinitionId, habitDefinitionId),
          ),
        );
    } else {
      const id = randomUUID();
      retainedIds.add(id);
      await database.insert(habitOptions).values({
        habitDefinitionId,
        id,
        label: option.label,
        sortOrder: option.sortOrder,
        stableValue: option.stableValue,
        userId,
      });
    }
  }
  for (const option of existing) {
    if (!retainedIds.has(option.id) && !referenced.has(option.id)) {
      await database
        .update(habitOptions)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(habitOptions.id, option.id),
            eq(habitOptions.userId, userId),
            eq(habitOptions.habitDefinitionId, habitDefinitionId),
          ),
        );
    }
  }
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
    await dependencies.database.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(habitDefinitions)
        .set(changes)
        .where(and(eq(habitDefinitions.id, id), eq(habitDefinitions.userId, user.id)))
        .returning();
      if (!updated) throw new ApiHttpError(404, 'HABIT_NOT_FOUND', 'Hábito não encontrado.');
      if (options) {
        await reconcileHabitOptions(transaction as unknown as DatabaseClient, user.id, id, options);
      }
    });
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
        abdomenCm: input.abdomenCm?.toString() ?? null,
        additionalMeasurements: input.additionalMeasurements ?? [],
        fasting: input.fasting ?? null,
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

  app.get('/api/v1/coffee-intakes', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { localDate } = parse(dateQuerySchema, request.query);
    const rows = await dependencies.database
      .select()
      .from(coffeeIntakes)
      .where(
        and(
          eq(coffeeIntakes.userId, user.id),
          eq(coffeeIntakes.localDate, localDate),
          isNull(coffeeIntakes.deletedAt),
        ),
      )
      .limit(1);
    // Ausência de linha significa "não registrado"; nunca "não consumi".
    return { item: rows[0] ? coffeeView(rows[0]) : null };
  });

  app.put('/api/v1/coffee-intakes/:localDate', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const params = parse(z.strictObject({ localDate: z.iso.date() }), request.params);
    const input = parse(coffeeIntakeCreateSchema.omit({ localDate: true }), request.body);
    const values = {
      deletedAt: null,
      localDate: params.localDate,
      notes: input.notes ?? null,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : null,
      status: input.status,
      userId: user.id,
    };
    const [saved] = await dependencies.database
      .insert(coffeeIntakes)
      .values({ id: input.id ?? randomUUID(), ...values })
      .onConflictDoUpdate({
        set: values,
        target: [coffeeIntakes.userId, coffeeIntakes.localDate],
        targetWhere: isNull(coffeeIntakes.deletedAt),
      })
      .returning();
    if (!saved) throw new Error('Coffee intake upsert did not return a row.');
    return coffeeView(saved);
  });

  app.get('/api/v1/whey-intakes', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { localDate } = parse(dateQuerySchema, request.query);
    const rows = await dependencies.database
      .select()
      .from(wheyIntakes)
      .where(
        and(
          eq(wheyIntakes.userId, user.id),
          eq(wheyIntakes.localDate, localDate),
          isNull(wheyIntakes.deletedAt),
        ),
      )
      .orderBy(asc(wheyIntakes.createdAt));
    return { items: rows.map(wheyView) };
  });

  app.post('/api/v1/whey-intakes', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const input = parse(wheyIntakeCreateSchema, request.body);
    const { id, ...fields } = input;
    const [created] = await dependencies.database
      .insert(wheyIntakes)
      .values({
        ...wheyValues(fields),
        consumed: fields.consumed,
        id: id ?? randomUUID(),
        localDate: fields.localDate,
        tolerance: fields.tolerance,
        userId: user.id,
      })
      .returning();
    if (!created) throw new Error('Whey intake insert did not return a row.');
    return reply.status(201).send(wheyView(created));
  });

  app.put('/api/v1/whey-intakes/:id', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const input = parse(wheyIntakeUpdateSchema, request.body);
    const [updated] = await dependencies.database
      .update(wheyIntakes)
      .set(wheyValues(input))
      .where(
        and(eq(wheyIntakes.id, id), eq(wheyIntakes.userId, user.id), isNull(wheyIntakes.deletedAt)),
      )
      .returning();
    if (!updated) throw new ApiHttpError(404, 'WHEY_INTAKE_NOT_FOUND', 'Registro não encontrado.');
    return wheyView(updated);
  });

  app.delete('/api/v1/whey-intakes/:id', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const [deleted] = await dependencies.database
      .update(wheyIntakes)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(wheyIntakes.id, id), eq(wheyIntakes.userId, user.id), isNull(wheyIntakes.deletedAt)),
      )
      .returning({ id: wheyIntakes.id });
    if (!deleted) throw new ApiHttpError(404, 'WHEY_INTAKE_NOT_FOUND', 'Registro não encontrado.');
    return reply.status(204).send();
  });

  /**
   * Etapa rápida e opcional exibida ao concluir o treino. A resposta "não" é gravada de forma
   * explícita e não gera relatos. Nenhum treino é alterado automaticamente.
   */
  app.post('/api/v1/sessions/:id/recovery', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const input = parse(sessionRecoverySchema, request.body);
    const [session] = await dependencies.database
      .select({ id: workoutSessions.id, plannedLocalDate: workoutSessions.plannedLocalDate })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.id, id),
          eq(workoutSessions.userId, user.id),
          isNull(workoutSessions.deletedAt),
        ),
      )
      .limit(1);
    if (!session) throw new ApiHttpError(404, 'SESSION_NOT_FOUND', 'Sessão não encontrada.');

    const created = await dependencies.database.transaction(async (transaction) => {
      await transaction
        .update(workoutSessions)
        .set({
          jointPainStatus:
            input.status === 'none'
              ? 'none'
              : input.reports.some((report) => report.type === 'joint')
                ? 'reported'
                : 'unknown',
          recoveryStatus: input.status,
        })
        .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, user.id)));
      if (input.reports.length === 0) return [];
      return transaction
        .insert(painReports)
        .values(
          input.reports.map((report) => ({
            ...report,
            customBodyRegion: report.customBodyRegion ?? null,
            exerciseId: report.exerciseId ?? null,
            exerciseSetId: report.exerciseSetId ?? null,
            id: randomUUID(),
            intensityScore: report.intensityScore ?? null,
            localDate: report.localDate,
            notes: report.notes ?? null,
            occurredAt: report.occurredAt ? new Date(report.occurredAt) : null,
            sessionId: id,
            supportDifficulty: report.supportDifficulty ?? null,
            swelling: report.swelling ?? null,
            userId: user.id,
          })),
        )
        .returning();
    });
    await evaluateProgressionForSession(dependencies.database, user.id, id, true);
    return {
      attention: created.map(painView).filter(recoveryDeservesAttention).length > 0,
      reports: created.map(painView),
      status: input.status,
    };
  });
}
