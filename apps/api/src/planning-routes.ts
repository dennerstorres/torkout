import {
  exerciseCreateSchema,
  exerciseUpdateSchema,
  materializeSessionsSchema,
  trainingPlanCreateSchema,
  trainingPlanUpdateSchema,
  workoutSessionCreateSchema,
  workoutSessionUpdateSchema,
  workoutTemplateCreateSchema,
  workoutTemplateUpdateSchema,
  type WorkoutExecution,
  type WorkoutTemplateCreate,
} from '@torkout/contracts';
import {
  exerciseSets,
  exercises,
  scheduleRules,
  sessionExercises,
  trainingPlans,
  walkingDetails,
  workoutSessions,
  workoutTemplateExercises,
  workoutTemplates,
  workoutTemplateSets,
  type DatabaseClient,
} from '@torkout/database';
import {
  calculateWorkoutCompletion,
  materializeWorkoutSessions,
  type PlanningTemplate,
} from '@torkout/domain';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ApiHttpError, type ApiDependencies, requireAuthenticatedUser } from './auth-routes.js';
import { evaluateProgressionForSession } from './progression-service.js';

const idParamsSchema = z.strictObject({ id: z.uuid() });
const deleteQuerySchema = z.strictObject({ version: z.coerce.number().int().positive() });
const sessionListQuerySchema = z
  .strictObject({ from: z.iso.date(), through: z.iso.date() })
  .refine((value) => value.through >= value.from);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Dados inválidos.');
  return result.data;
}

function exerciseView(row: typeof exercises.$inferSelect) {
  return {
    active: row.active,
    category: row.category,
    id: row.id,
    instructions: row.instructions,
    isSystem: row.isSystem,
    name: row.name,
    trackingMetric: row.trackingMetric,
    version: row.version,
  };
}

function planView(row: typeof trainingPlans.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    version: row.version,
  };
}

async function findOwnedExercise(database: DatabaseClient, userId: string, id: string) {
  const [row] = await database
    .select()
    .from(exercises)
    .where(
      and(
        eq(exercises.id, id),
        eq(exercises.userId, userId),
        eq(exercises.isSystem, false),
        isNull(exercises.deletedAt),
      ),
    )
    .limit(1);
  return row;
}

async function assertExercisesAvailable(
  database: DatabaseClient,
  userId: string,
  exerciseIds: string[],
): Promise<void> {
  if (exerciseIds.length === 0) return;
  const rows = await database
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        inArray(exercises.id, exerciseIds),
        or(eq(exercises.userId, userId), eq(exercises.isSystem, true)),
        eq(exercises.active, true),
        isNull(exercises.deletedAt),
      ),
    );
  if (new Set(rows.map((row) => row.id)).size !== new Set(exerciseIds).size) {
    throw new ApiHttpError(400, 'EXERCISE_UNAVAILABLE', 'Exercício indisponível.');
  }
}

async function findOwnedPlan(database: DatabaseClient, userId: string, id: string) {
  const [row] = await database
    .select()
    .from(trainingPlans)
    .where(
      and(
        eq(trainingPlans.id, id),
        eq(trainingPlans.userId, userId),
        isNull(trainingPlans.deletedAt),
      ),
    )
    .limit(1);
  return row;
}

export async function loadTemplate(database: DatabaseClient, userId: string, id: string) {
  const [template] = await database
    .select()
    .from(workoutTemplates)
    .where(
      and(
        eq(workoutTemplates.id, id),
        eq(workoutTemplates.userId, userId),
        isNull(workoutTemplates.deletedAt),
      ),
    )
    .limit(1);
  if (!template) return undefined;
  const exerciseRows = await database
    .select()
    .from(workoutTemplateExercises)
    .where(
      and(
        eq(workoutTemplateExercises.templateId, id),
        eq(workoutTemplateExercises.userId, userId),
        isNull(workoutTemplateExercises.deletedAt),
      ),
    )
    .orderBy(asc(workoutTemplateExercises.sortOrder));
  const setRows =
    exerciseRows.length === 0
      ? []
      : await database
          .select()
          .from(workoutTemplateSets)
          .where(
            and(
              inArray(
                workoutTemplateSets.templateExerciseId,
                exerciseRows.map((row) => row.id),
              ),
              eq(workoutTemplateSets.userId, userId),
              isNull(workoutTemplateSets.deletedAt),
            ),
          )
          .orderBy(asc(workoutTemplateSets.setNumber));
  const exerciseCatalog =
    exerciseRows.length === 0
      ? []
      : await database
          .select()
          .from(exercises)
          .where(
            inArray(
              exercises.id,
              exerciseRows.map((row) => row.exerciseId),
            ),
          );
  const catalogById = new Map(exerciseCatalog.map((row) => [row.id, row]));
  const rules = await database
    .select()
    .from(scheduleRules)
    .where(
      and(
        eq(scheduleRules.templateId, id),
        eq(scheduleRules.userId, userId),
        isNull(scheduleRules.deletedAt),
      ),
    )
    .orderBy(asc(scheduleRules.weekday), asc(scheduleRules.localTime));
  return {
    exercises: exerciseRows.map((row) => {
      const exercise = catalogById.get(row.exerciseId);
      if (!exercise) throw new Error('Template exercise points to a missing exercise.');
      return {
        exerciseId: row.exerciseId,
        id: row.id,
        name: exercise.name,
        notes: row.notes,
        sets: setRows
          .filter((set) => set.templateExerciseId === row.id)
          .map((set) => ({
            id: set.id,
            setNumber: set.setNumber,
            ...(set.targetDistanceMeters === null
              ? {}
              : { targetDistanceMeters: Number(set.targetDistanceMeters) }),
            ...(set.targetDurationSeconds === null
              ? {}
              : { targetDurationSeconds: set.targetDurationSeconds }),
            ...(set.targetRepetitions === null ? {} : { targetRepetitions: set.targetRepetitions }),
          })),
        sortOrder: row.sortOrder,
        trackingMetric: exercise.trackingMetric,
      };
    }),
    id: template.id,
    name: template.name,
    notes: template.notes,
    planId: template.planId,
    rules: rules.map((rule) => ({
      id: rule.id,
      localTime: rule.localTime.slice(0, 5),
      timeZone: rule.timeZone,
      validFrom: rule.validFrom,
      validUntil: rule.validUntil,
      weekday: rule.weekday,
    })),
    type: template.type,
    version: template.version,
  };
}

export async function insertTemplateAggregate(
  database: DatabaseClient,
  userId: string,
  input: WorkoutTemplateCreate,
  id: string,
): Promise<void> {
  await assertExercisesAvailable(
    database,
    userId,
    input.exercises.map((item) => item.exerciseId),
  );
  await database.transaction(async (transaction) => {
    await transaction.insert(workoutTemplates).values({
      id,
      name: input.name,
      notes: input.notes ?? null,
      planId: input.planId,
      type: input.type,
      userId,
    });
    for (const exercise of input.exercises) {
      const templateExerciseId = exercise.id ?? randomUUID();
      await transaction.insert(workoutTemplateExercises).values({
        exerciseId: exercise.exerciseId,
        id: templateExerciseId,
        notes: exercise.notes ?? null,
        sortOrder: exercise.sortOrder,
        templateId: id,
        userId,
      });
      if (exercise.sets.length > 0) {
        await transaction.insert(workoutTemplateSets).values(
          exercise.sets.map((set) => ({
            id: set.id ?? randomUUID(),
            setNumber: set.setNumber,
            targetDistanceMeters: set.targetDistanceMeters?.toString(),
            targetDurationSeconds: set.targetDurationSeconds,
            targetRepetitions: set.targetRepetitions,
            templateExerciseId,
            userId,
          })),
        );
      }
    }
    if (input.rules.length > 0) {
      await transaction.insert(scheduleRules).values(
        input.rules.map((rule) => ({
          id: rule.id,
          localTime: rule.localTime,
          templateId: id,
          timeZone: rule.timeZone,
          userId,
          validFrom: rule.validFrom,
          validUntil: rule.validUntil ?? null,
          weekday: rule.weekday,
        })),
      );
    }
  });
}

export async function loadSession(database: DatabaseClient, userId: string, id: string) {
  const [session] = await database
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.id, id),
        eq(workoutSessions.userId, userId),
        isNull(workoutSessions.deletedAt),
      ),
    )
    .limit(1);
  if (!session) return undefined;
  const exerciseRows = await database
    .select()
    .from(sessionExercises)
    .where(
      and(
        eq(sessionExercises.sessionId, id),
        eq(sessionExercises.userId, userId),
        isNull(sessionExercises.deletedAt),
      ),
    )
    .orderBy(asc(sessionExercises.sortOrder));
  const setRows =
    exerciseRows.length === 0
      ? []
      : await database
          .select()
          .from(exerciseSets)
          .where(
            and(
              inArray(
                exerciseSets.sessionExerciseId,
                exerciseRows.map((row) => row.id),
              ),
              eq(exerciseSets.userId, userId),
              isNull(exerciseSets.deletedAt),
            ),
          )
          .orderBy(asc(exerciseSets.setNumber));
  const [walking] = await database
    .select()
    .from(walkingDetails)
    .where(
      and(
        eq(walkingDetails.sessionId, id),
        eq(walkingDetails.userId, userId),
        isNull(walkingDetails.deletedAt),
      ),
    )
    .limit(1);
  return {
    exercises: exerciseRows.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      id: exercise.id,
      name: exercise.exerciseNameSnapshot,
      notes: exercise.notes,
      sets: setRows
        .filter((set) => set.sessionExerciseId === exercise.id)
        .map((set) => ({
          actualDistanceMeters:
            set.actualDistanceMeters === null ? null : Number(set.actualDistanceMeters),
          actualDurationSeconds: set.actualDurationSeconds,
          actualRepetitions: set.actualRepetitions,
          completed: set.completed,
          id: set.id,
          plannedDistanceMeters:
            set.plannedDistanceMeters === null ? null : Number(set.plannedDistanceMeters),
          plannedDurationSeconds: set.plannedDurationSeconds,
          plannedRepetitions: set.plannedRepetitions,
          setNumber: set.setNumber,
        })),
      sortOrder: exercise.sortOrder,
      status: exercise.status,
      trackingMetric: exercise.trackingMetricSnapshot,
    })),
    id: session.id,
    completedAt: session.completedAt?.toISOString() ?? null,
    importKey: session.importKey,
    jointPainStatus: session.jointPainStatus,
    notes: session.notes,
    plannedLocalDate: session.plannedLocalDate,
    scheduleRuleId: session.scheduleRuleId,
    source: session.source,
    status: session.status,
    startedAt: session.startedAt?.toISOString() ?? null,
    suggestedLocalTime: session.suggestedLocalTime?.slice(0, 5) ?? null,
    templateId: session.templateId,
    templateNameSnapshot: session.templateNameSnapshot,
    timeZone: session.timeZone,
    type: session.type,
    version: session.version,
    walking: walking
      ? {
          actualDistanceMeters:
            walking.actualDistanceMeters === null ? null : Number(walking.actualDistanceMeters),
          distanceSource: walking.distanceSource,
          durationSeconds: walking.durationSeconds,
          notes: walking.notes,
          plannedDistanceMeters:
            walking.plannedDistanceMeters === null ? null : Number(walking.plannedDistanceMeters),
        }
      : null,
  };
}

export async function insertSessionAggregate(
  database: DatabaseClient,
  userId: string,
  input: z.infer<typeof workoutSessionCreateSchema>,
  id: string,
): Promise<boolean> {
  return database.transaction(async (transaction) => {
    const inserted = await transaction
      .insert(workoutSessions)
      .values({
        id,
        importKey: input.importKey ?? null,
        notes: input.notes ?? null,
        plannedLocalDate: input.plannedLocalDate,
        scheduleRuleId: input.scheduleRuleId ?? null,
        source: input.source,
        status: input.status,
        suggestedLocalTime: input.suggestedLocalTime ?? null,
        templateId: input.templateId ?? null,
        templateNameSnapshot: input.templateNameSnapshot,
        timeZone: input.timeZone,
        type: input.type,
        userId,
      })
      .onConflictDoNothing()
      .returning({ id: workoutSessions.id });
    if (inserted.length === 0) return false;
    for (const exercise of input.exercises) {
      const sessionExerciseId = exercise.id ?? randomUUID();
      await transaction.insert(sessionExercises).values({
        exerciseId: exercise.exerciseId,
        exerciseNameSnapshot: exercise.name,
        id: sessionExerciseId,
        notes: exercise.notes ?? null,
        sessionId: id,
        sortOrder: exercise.sortOrder,
        trackingMetricSnapshot: exercise.trackingMetric,
        userId,
      });
      if (exercise.sets.length > 0) {
        await transaction.insert(exerciseSets).values(
          exercise.sets.map((set) => ({
            id: set.id ?? randomUUID(),
            plannedDistanceMeters: set.targetDistanceMeters?.toString(),
            plannedDurationSeconds: set.targetDurationSeconds,
            plannedRepetitions: set.targetRepetitions,
            sessionExerciseId,
            setNumber: set.setNumber,
            userId,
          })),
        );
      }
    }
    return true;
  });
}

export async function applySessionExecution(
  database: DatabaseClient,
  userId: string,
  sessionId: string,
  input: {
    execution: WorkoutExecution;
    notes?: string | null | undefined;
    version: number;
  },
): Promise<Awaited<ReturnType<typeof loadSession>>> {
  await database.transaction(async (transaction) => {
    const [session] = await transaction
      .select({ id: workoutSessions.id })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.id, sessionId),
          eq(workoutSessions.userId, userId),
          eq(workoutSessions.version, input.version),
          isNull(workoutSessions.deletedAt),
        ),
      )
      .limit(1);
    if (!session) throw new ApiHttpError(409, 'VERSION_CONFLICT', 'A sessão foi alterada.');

    const exerciseIds = input.execution.exercises.map((exercise) => exercise.id);
    const ownedExercises =
      exerciseIds.length === 0
        ? []
        : await transaction
            .select({ id: sessionExercises.id })
            .from(sessionExercises)
            .where(
              and(
                inArray(sessionExercises.id, exerciseIds),
                eq(sessionExercises.sessionId, sessionId),
                eq(sessionExercises.userId, userId),
                isNull(sessionExercises.deletedAt),
              ),
            );
    if (ownedExercises.length !== new Set(exerciseIds).size) {
      throw new ApiHttpError(400, 'INVALID_SESSION_EXERCISE', 'Exercício inválido para a sessão.');
    }

    for (const exercise of input.execution.exercises) {
      await transaction
        .update(sessionExercises)
        .set({ notes: exercise.notes ?? null, status: exercise.status })
        .where(
          and(
            eq(sessionExercises.id, exercise.id),
            eq(sessionExercises.sessionId, sessionId),
            eq(sessionExercises.userId, userId),
          ),
        );
      for (const set of exercise.sets) {
        const [currentSet] = await transaction
          .select({ id: exerciseSets.id, sessionExerciseId: exerciseSets.sessionExerciseId })
          .from(exerciseSets)
          .where(and(eq(exerciseSets.id, set.id), eq(exerciseSets.userId, userId)))
          .limit(1);
        const values = {
          actualDistanceMeters: set.actualDistanceMeters?.toString() ?? null,
          actualDurationSeconds: set.actualDurationSeconds ?? null,
          actualRepetitions: set.actualRepetitions ?? null,
          completed: set.completed,
        };
        if (currentSet) {
          if (currentSet.sessionExerciseId !== exercise.id) {
            throw new ApiHttpError(400, 'INVALID_EXERCISE_SET', 'Série inválida para o exercício.');
          }
          await transaction.update(exerciseSets).set(values).where(eq(exerciseSets.id, set.id));
        } else {
          await transaction.insert(exerciseSets).values({
            ...values,
            id: set.id,
            sessionExerciseId: exercise.id,
            setNumber: set.setNumber,
            userId,
          });
        }
      }
    }

    if (input.execution.walking) {
      const walking = input.execution.walking;
      await transaction
        .insert(walkingDetails)
        .values({
          actualDistanceMeters: walking.actualDistanceMeters?.toString() ?? null,
          distanceSource: walking.distanceSource,
          durationSeconds: walking.durationSeconds ?? null,
          notes: walking.notes ?? null,
          sessionId,
          userId,
        })
        .onConflictDoUpdate({
          set: {
            actualDistanceMeters: walking.actualDistanceMeters?.toString() ?? null,
            distanceSource: walking.distanceSource,
            durationSeconds: walking.durationSeconds ?? null,
            notes: walking.notes ?? null,
          },
          target: walkingDetails.sessionId,
        });
    }

    const status =
      input.execution.exercises.length === 0
        ? 'completed'
        : calculateWorkoutCompletion(input.execution.exercises);
    await transaction
      .update(workoutSessions)
      .set({
        completedAt: input.execution.completedAt
          ? new Date(input.execution.completedAt)
          : status === 'completed' || status === 'partial'
            ? new Date()
            : null,
        jointPainStatus: input.execution.jointPainStatus,
        notes: input.notes,
        startedAt: input.execution.startedAt ? new Date(input.execution.startedAt) : new Date(),
        status,
      })
      .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)));
  });
  return loadSession(database, userId, sessionId);
}

export function registerPlanningRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  app.get('/api/v1/exercises', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const rows = await dependencies.database
      .select()
      .from(exercises)
      .where(
        and(
          or(eq(exercises.isSystem, true), eq(exercises.userId, user.id)),
          isNull(exercises.deletedAt),
        ),
      )
      .orderBy(asc(exercises.name));
    return { items: rows.map(exerciseView) };
  });

  app.post('/api/v1/exercises', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const input = parse(exerciseCreateSchema, request.body);
    const [created] = await dependencies.database
      .insert(exercises)
      .values({ ...input, id: input.id ?? randomUUID(), isSystem: false, userId: user.id })
      .returning();
    if (!created) throw new Error('Exercise insert did not return a row.');
    return reply.status(201).send(exerciseView(created));
  });

  app.put('/api/v1/exercises/:id', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const input = parse(exerciseUpdateSchema, request.body);
    const current = await findOwnedExercise(dependencies.database, user.id, id);
    if (!current) throw new ApiHttpError(404, 'EXERCISE_NOT_FOUND', 'Exercício não encontrado.');
    if (current.version !== input.version) {
      throw new ApiHttpError(409, 'VERSION_CONFLICT', 'O exercício foi alterado em outro local.');
    }
    const { version, ...changes } = input;
    void version;
    const [updated] = await dependencies.database
      .update(exercises)
      .set(changes)
      .where(
        and(
          eq(exercises.id, id),
          eq(exercises.userId, user.id),
          eq(exercises.version, input.version),
        ),
      )
      .returning();
    if (!updated) throw new ApiHttpError(409, 'VERSION_CONFLICT', 'O exercício foi alterado.');
    return exerciseView(updated);
  });

  app.delete('/api/v1/exercises/:id', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const { version } = parse(deleteQuerySchema, request.query);
    const [updated] = await dependencies.database
      .update(exercises)
      .set({ active: false })
      .where(
        and(eq(exercises.id, id), eq(exercises.userId, user.id), eq(exercises.version, version)),
      )
      .returning();
    if (!updated) throw new ApiHttpError(404, 'EXERCISE_NOT_FOUND', 'Exercício não encontrado.');
    return exerciseView(updated);
  });

  app.get('/api/v1/plans', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const rows = await dependencies.database
      .select()
      .from(trainingPlans)
      .where(and(eq(trainingPlans.userId, user.id), isNull(trainingPlans.deletedAt)))
      .orderBy(asc(trainingPlans.validFrom), asc(trainingPlans.name));
    return { items: rows.map(planView) };
  });

  app.post('/api/v1/plans', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const input = parse(trainingPlanCreateSchema, request.body);
    const [created] = await dependencies.database
      .insert(trainingPlans)
      .values({
        ...input,
        id: input.id ?? randomUUID(),
        validUntil: input.validUntil ?? null,
        userId: user.id,
      })
      .returning();
    if (!created) throw new Error('Plan insert did not return a row.');
    return reply.status(201).send(planView(created));
  });

  app.put('/api/v1/plans/:id', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const input = parse(trainingPlanUpdateSchema, request.body);
    const current = await findOwnedPlan(dependencies.database, user.id, id);
    if (!current) throw new ApiHttpError(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.');
    if (current.version !== input.version)
      throw new ApiHttpError(409, 'VERSION_CONFLICT', 'Plano alterado.');
    const { effectiveFrom, version, ...changes } = input;
    void effectiveFrom;
    void version;
    const [updated] = await dependencies.database
      .update(trainingPlans)
      .set(changes)
      .where(
        and(
          eq(trainingPlans.id, id),
          eq(trainingPlans.userId, user.id),
          eq(trainingPlans.version, input.version),
        ),
      )
      .returning();
    if (!updated) throw new ApiHttpError(409, 'VERSION_CONFLICT', 'Plano alterado.');
    return planView(updated);
  });

  app.delete('/api/v1/plans/:id', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const { version } = parse(deleteQuerySchema, request.query);
    const [archived] = await dependencies.database
      .update(trainingPlans)
      .set({ deletedAt: new Date(), status: 'archived' })
      .where(
        and(
          eq(trainingPlans.id, id),
          eq(trainingPlans.userId, user.id),
          eq(trainingPlans.version, version),
          isNull(trainingPlans.deletedAt),
        ),
      )
      .returning();
    if (!archived) throw new ApiHttpError(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.');
    return planView(archived);
  });

  app.get('/api/v1/templates', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const ids = await dependencies.database
      .select({ id: workoutTemplates.id })
      .from(workoutTemplates)
      .where(and(eq(workoutTemplates.userId, user.id), isNull(workoutTemplates.deletedAt)))
      .orderBy(asc(workoutTemplates.name));
    return {
      items: (
        await Promise.all(ids.map((row) => loadTemplate(dependencies.database, user.id, row.id)))
      ).filter(Boolean),
    };
  });

  app.get('/api/v1/templates/:id', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const template = await loadTemplate(dependencies.database, user.id, id);
    if (!template) throw new ApiHttpError(404, 'TEMPLATE_NOT_FOUND', 'Template não encontrado.');
    return template;
  });

  app.post('/api/v1/templates', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const input = parse(workoutTemplateCreateSchema, request.body);
    if (!(await findOwnedPlan(dependencies.database, user.id, input.planId))) {
      throw new ApiHttpError(400, 'PLAN_NOT_FOUND', 'Plano não encontrado.');
    }
    const id = input.id ?? randomUUID();
    await insertTemplateAggregate(dependencies.database, user.id, input, id);
    return reply.status(201).send(await loadTemplate(dependencies.database, user.id, id));
  });

  app.put('/api/v1/templates/:id', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const input = parse(workoutTemplateUpdateSchema, request.body);
    const current = await loadTemplate(dependencies.database, user.id, id);
    if (!current) throw new ApiHttpError(404, 'TEMPLATE_NOT_FOUND', 'Template não encontrado.');
    if (current.version !== input.version)
      throw new ApiHttpError(409, 'VERSION_CONFLICT', 'Template alterado.');
    await assertExercisesAvailable(
      dependencies.database,
      user.id,
      input.exercises.map((item) => item.exerciseId),
    );
    await dependencies.database.transaction(async (transaction) => {
      await transaction
        .delete(workoutSessions)
        .where(
          and(
            eq(workoutSessions.userId, user.id),
            eq(workoutSessions.templateId, id),
            eq(workoutSessions.status, 'planned'),
            gte(workoutSessions.plannedLocalDate, input.effectiveFrom),
          ),
        );
      await transaction.delete(scheduleRules).where(eq(scheduleRules.templateId, id));
      await transaction
        .delete(workoutTemplateExercises)
        .where(eq(workoutTemplateExercises.templateId, id));
      await transaction
        .update(workoutTemplates)
        .set({
          name: input.name,
          notes: input.notes ?? null,
          planId: input.planId,
          type: input.type,
        })
        .where(
          and(
            eq(workoutTemplates.id, id),
            eq(workoutTemplates.userId, user.id),
            eq(workoutTemplates.version, input.version),
          ),
        );
      for (const exercise of input.exercises) {
        const templateExerciseId = exercise.id ?? randomUUID();
        await transaction.insert(workoutTemplateExercises).values({
          exerciseId: exercise.exerciseId,
          id: templateExerciseId,
          notes: exercise.notes ?? null,
          sortOrder: exercise.sortOrder,
          templateId: id,
          userId: user.id,
        });
        if (exercise.sets.length > 0) {
          await transaction.insert(workoutTemplateSets).values(
            exercise.sets.map((set) => ({
              id: set.id ?? randomUUID(),
              setNumber: set.setNumber,
              targetDistanceMeters: set.targetDistanceMeters?.toString(),
              targetDurationSeconds: set.targetDurationSeconds,
              targetRepetitions: set.targetRepetitions,
              templateExerciseId,
              userId: user.id,
            })),
          );
        }
      }
      if (input.rules.length > 0) {
        await transaction.insert(scheduleRules).values(
          input.rules.map((rule) => ({
            id: rule.id,
            localTime: rule.localTime,
            templateId: id,
            timeZone: rule.timeZone,
            userId: user.id,
            validFrom: rule.validFrom,
            validUntil: rule.validUntil ?? null,
            weekday: rule.weekday,
          })),
        );
      }
    });
    return loadTemplate(dependencies.database, user.id, id);
  });

  app.delete('/api/v1/templates/:id', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const { version } = parse(deleteQuerySchema, request.query);
    const deleted = await dependencies.database.transaction(async (transaction) => {
      const [template] = await transaction
        .update(workoutTemplates)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(workoutTemplates.id, id),
            eq(workoutTemplates.userId, user.id),
            eq(workoutTemplates.version, version),
            isNull(workoutTemplates.deletedAt),
          ),
        )
        .returning({
          deletedAt: workoutTemplates.deletedAt,
          id: workoutTemplates.id,
          version: workoutTemplates.version,
        });
      if (!template) return undefined;
      await transaction
        .update(workoutSessions)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(workoutSessions.userId, user.id),
            eq(workoutSessions.templateId, id),
            eq(workoutSessions.status, 'planned'),
            isNull(workoutSessions.deletedAt),
          ),
        );
      return template;
    });
    if (!deleted) throw new ApiHttpError(404, 'TEMPLATE_NOT_FOUND', 'Template não encontrado.');
    return {
      deletedAt: deleted.deletedAt?.toISOString() ?? null,
      id: deleted.id,
      version: deleted.version,
    };
  });

  app.get('/api/v1/sessions', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const query = parse(sessionListQuerySchema, request.query);
    const ids = await dependencies.database
      .select({ id: workoutSessions.id })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, user.id),
          gte(workoutSessions.plannedLocalDate, query.from),
          lte(workoutSessions.plannedLocalDate, query.through),
          isNull(workoutSessions.deletedAt),
        ),
      )
      .orderBy(asc(workoutSessions.plannedLocalDate), asc(workoutSessions.suggestedLocalTime));
    return {
      items: (
        await Promise.all(ids.map((row) => loadSession(dependencies.database, user.id, row.id)))
      ).filter(Boolean),
    };
  });

  app.post('/api/v1/sessions', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const input = parse(workoutSessionCreateSchema, request.body);
    const id = input.id ?? randomUUID();
    await insertSessionAggregate(dependencies.database, user.id, input, id);
    return reply.status(201).send(await loadSession(dependencies.database, user.id, id));
  });

  app.put('/api/v1/sessions/:id', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const input = parse(workoutSessionUpdateSchema, request.body);
    const { version, ...changes } = input;
    const [updated] = await dependencies.database
      .update(workoutSessions)
      .set(changes)
      .where(
        and(
          eq(workoutSessions.id, id),
          eq(workoutSessions.userId, user.id),
          eq(workoutSessions.version, version),
          isNull(workoutSessions.deletedAt),
        ),
      )
      .returning({ id: workoutSessions.id });
    if (!updated) throw new ApiHttpError(404, 'SESSION_NOT_FOUND', 'Sessão não encontrada.');
    await evaluateProgressionForSession(dependencies.database, user.id, id);
    return loadSession(dependencies.database, user.id, id);
  });

  app.post('/api/v1/sessions/materialize', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const window = parse(materializeSessionsSchema, request.body);
    const ruleRows = await dependencies.database
      .select({ id: scheduleRules.id, templateId: scheduleRules.templateId })
      .from(scheduleRules)
      .innerJoin(workoutTemplates, eq(workoutTemplates.id, scheduleRules.templateId))
      .innerJoin(trainingPlans, eq(trainingPlans.id, workoutTemplates.planId))
      .where(
        and(
          eq(scheduleRules.userId, user.id),
          eq(trainingPlans.status, 'active'),
          lte(scheduleRules.validFrom, window.through),
          or(isNull(scheduleRules.validUntil), gte(scheduleRules.validUntil, window.from)),
          lte(trainingPlans.validFrom, window.through),
          or(isNull(trainingPlans.validUntil), gte(trainingPlans.validUntil, window.from)),
          isNull(scheduleRules.deletedAt),
          isNull(workoutTemplates.deletedAt),
          isNull(trainingPlans.deletedAt),
        ),
      );
    const templates = new Map<string, NonNullable<Awaited<ReturnType<typeof loadTemplate>>>>();
    for (const row of ruleRows) {
      if (!templates.has(row.templateId)) {
        const template = await loadTemplate(dependencies.database, user.id, row.templateId);
        if (template) templates.set(row.templateId, template);
      }
    }
    const existingIds = await dependencies.database
      .select({ id: workoutSessions.id })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, user.id),
          gte(workoutSessions.plannedLocalDate, window.from),
          lte(workoutSessions.plannedLocalDate, window.through),
          isNull(workoutSessions.deletedAt),
        ),
      );
    const existingViews = (
      await Promise.all(
        existingIds.map((row) => loadSession(dependencies.database, user.id, row.id)),
      )
    ).filter((item): item is NonNullable<typeof item> => Boolean(item));
    const planningTemplates = new Map<string, PlanningTemplate>();
    for (const [id, template] of templates) {
      planningTemplates.set(id, {
        exercises: template.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          notes: exercise.notes,
          sets: exercise.sets.map((set) => ({
            setNumber: set.setNumber,
            ...(set.targetDistanceMeters === undefined
              ? {}
              : { targetDistanceMeters: set.targetDistanceMeters }),
            ...(set.targetDurationSeconds === undefined
              ? {}
              : { targetDurationSeconds: set.targetDurationSeconds }),
            ...(set.targetRepetitions === undefined
              ? {}
              : { targetRepetitions: set.targetRepetitions }),
          })),
          sortOrder: exercise.sortOrder,
          trackingMetric: exercise.trackingMetric,
        })),
        id,
        name: template.name,
        notes: template.notes,
        type: template.type,
      });
    }
    const rules = ruleRows.flatMap((row) => {
      const template = templates.get(row.templateId);
      const planningTemplate = planningTemplates.get(row.templateId);
      const rule = template?.rules.find((item) => item.id === row.id);
      return rule && planningTemplate
        ? [{ ...rule, template: planningTemplate, validUntil: rule.validUntil ?? null }]
        : [];
    });
    const materialized = materializeWorkoutSessions({
      existing: existingViews.map((session) => ({
        exercises: session.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId ?? randomUUID(),
          name: exercise.name,
          notes: exercise.notes,
          sets: exercise.sets.map((set) => ({
            setNumber: set.setNumber,
            ...(set.plannedDistanceMeters === null
              ? {}
              : { targetDistanceMeters: set.plannedDistanceMeters }),
            ...(set.plannedDurationSeconds === null
              ? {}
              : { targetDurationSeconds: set.plannedDurationSeconds }),
            ...(set.plannedRepetitions === null
              ? {}
              : { targetRepetitions: set.plannedRepetitions }),
          })),
          sortOrder: exercise.sortOrder,
          trackingMetric: exercise.trackingMetric,
        })),
        id: session.id,
        plannedInstant: `${session.plannedLocalDate}T00:00:00Z`,
        plannedLocalDate: session.plannedLocalDate,
        scheduleRuleId: session.scheduleRuleId,
        source: session.source,
        status: session.status,
        suggestedLocalTime: session.suggestedLocalTime,
        templateId: session.templateId,
        templateNameSnapshot: session.templateNameSnapshot,
        timeZone: session.timeZone,
        type: session.type,
      })),
      from: window.from,
      idFor: () => randomUUID(),
      rules,
      through: window.through,
    });
    const existingIdSet = new Set(existingViews.map((session) => session.id));
    let created = 0;
    for (const session of materialized.filter((item) => !existingIdSet.has(item.id))) {
      const inserted = await insertSessionAggregate(
        dependencies.database,
        user.id,
        {
          exercises: session.exercises,
          plannedLocalDate: session.plannedLocalDate,
          scheduleRuleId: session.scheduleRuleId,
          source: session.source,
          status: session.status,
          suggestedLocalTime: session.suggestedLocalTime,
          templateId: session.templateId,
          templateNameSnapshot: session.templateNameSnapshot,
          timeZone: session.timeZone,
          type: session.type,
        },
        session.id,
      );
      if (inserted) created += 1;
    }
    return { created };
  });
}
