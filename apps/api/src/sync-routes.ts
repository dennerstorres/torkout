import {
  bodyMeasurementCreatePayloadSchema,
  syncOperationSchema,
  syncPushRequestSchema,
  type SyncOperation,
  type SyncPushResult,
} from '@torkout/contracts';
import {
  bodyMeasurements,
  changeLog,
  exerciseSets,
  exercises,
  habitDefinitions,
  habitEntries,
  habitOptions,
  painReports,
  scheduleRules,
  type DatabaseClient,
  registeredDevices,
  syncOperations,
  trainingPlans,
  workoutSessions,
  workoutTemplateExercises,
  workoutTemplates,
  workoutTemplateSets,
} from '@torkout/database';
import { createHash, randomUUID } from 'node:crypto';
import { and, asc, eq, gt, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ApiHttpError, type ApiDependencies, requireAuthenticatedUser } from './auth-routes.js';
import {
  insertHabitDefinition,
  loadHabitDefinition,
  reconcileHabitOptions,
} from './daily-routes.js';
import {
  applySessionExecution,
  insertSessionAggregate,
  insertTemplateAggregate,
  loadSession,
  loadTemplate,
  updatePlannedAdHocSession,
} from './planning-routes.js';
import { evaluateProgressionForSession } from './progression-service.js';

type SyncTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];
type MeasurementRow = typeof bodyMeasurements.$inferSelect;
type SyncRecord = NonNullable<SyncPushResult['record']>;

const pullQuerySchema = z.strictObject({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function serializeMeasurement(row: MeasurementRow, tombstoneOnly = false): SyncRecord {
  const identity = {
    deletedAt: row.deletedAt?.toISOString() ?? null,
    id: row.id,
    version: row.version,
  };
  if (tombstoneOnly) return identity;
  return {
    ...identity,
    additionalMeasurements: row.additionalMeasurements,
    localDate: row.localDate,
    measuredAt: row.measuredAt.toISOString(),
    notes: row.notes,
    waistCm: row.waistCm === null ? null : Number(row.waistCm),
    weightKg: row.weightKg === null ? null : Number(row.weightKg),
  };
}

function encodeCursor(sequence: number): string {
  return Buffer.from(JSON.stringify({ sequence, version: 1 })).toString('base64url');
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      sequence?: unknown;
      version?: unknown;
    };
    if (
      value.version !== 1 ||
      !Number.isSafeInteger(value.sequence) ||
      Number(value.sequence) < 0
    ) {
      throw new Error('invalid cursor');
    }
    return Number(value.sequence);
  } catch {
    throw new ApiHttpError(400, 'INVALID_CURSOR', 'Cursor de sincronização inválido.');
  }
}

async function ensureDevice(
  database: DatabaseClient,
  userId: string,
  deviceId: string,
): Promise<boolean> {
  const [existing] = await database
    .select({ userId: registeredDevices.userId })
    .from(registeredDevices)
    .where(eq(registeredDevices.id, deviceId))
    .limit(1);
  if (existing) {
    if (existing.userId !== userId) return false;
    await database
      .update(registeredDevices)
      .set({ lastSyncedAt: new Date() })
      .where(and(eq(registeredDevices.id, deviceId), eq(registeredDevices.userId, userId)));
    return true;
  }

  const now = new Date();
  await database
    .insert(registeredDevices)
    .values({
      createdAt: now,
      deviceKeyHash: createHash('sha256').update(deviceId).digest('hex'),
      id: deviceId,
      lastSyncedAt: now,
      offlineAuthorizedUntil: new Date(now.getTime() + 30 * 86_400_000),
      updatedAt: now,
      userId,
    })
    .onConflictDoNothing({ target: registeredDevices.id });
  const [created] = await database
    .select({ userId: registeredDevices.userId })
    .from(registeredDevices)
    .where(eq(registeredDevices.id, deviceId))
    .limit(1);
  return created?.userId === userId;
}

async function findMeasurement(
  transaction: SyncTransaction,
  userId: string,
  entityId: string,
): Promise<MeasurementRow | undefined> {
  const [row] = await transaction
    .select()
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.id, entityId), eq(bodyMeasurements.userId, userId)))
    .limit(1);
  return row;
}

async function applyMeasurementOperation(
  transaction: SyncTransaction,
  userId: string,
  operation: SyncOperation,
): Promise<SyncPushResult> {
  if (operation.entityType !== 'body_measurement') {
    return {
      errorCode: 'invalid_entity_handler',
      operationId: operation.operationId,
      status: 'rejected',
    };
  }
  const current = await findMeasurement(transaction, userId, operation.entityId);
  if (operation.operation === 'create') {
    if (current) {
      return {
        errorCode: 'entity_already_exists',
        operationId: operation.operationId,
        record: serializeMeasurement(current),
        status: 'conflict',
      };
    }
    const [foreign] = await transaction
      .select({ id: bodyMeasurements.id })
      .from(bodyMeasurements)
      .where(eq(bodyMeasurements.id, operation.entityId))
      .limit(1);
    if (foreign) return { operationId: operation.operationId, status: 'unauthorized' };
    const [created] = await transaction
      .insert(bodyMeasurements)
      .values({
        id: operation.entityId,
        additionalMeasurements: operation.payload.additionalMeasurements ?? [],
        localDate: operation.payload.localDate,
        measuredAt: new Date(operation.payload.measuredAt),
        notes: operation.payload.notes ?? null,
        userId,
        waistCm: operation.payload.waistCm?.toString() ?? null,
        weightKg: operation.payload.weightKg?.toString() ?? null,
      })
      .returning();
    if (!created) throw new Error('Measurement insert did not return a row.');
    return {
      operationId: operation.operationId,
      record: serializeMeasurement(created),
      status: 'applied',
    };
  }

  if (!current) {
    return {
      errorCode: 'entity_not_found',
      operationId: operation.operationId,
      status: 'rejected',
    };
  }
  if (current.version !== operation.baseVersion || current.deletedAt) {
    return {
      errorCode: 'version_conflict',
      operationId: operation.operationId,
      record: serializeMeasurement(current, current.deletedAt !== null),
      status: 'conflict',
    };
  }

  if (operation.operation === 'delete') {
    const [deleted] = await transaction
      .update(bodyMeasurements)
      .set({ deletedAt: new Date() })
      .where(and(eq(bodyMeasurements.id, operation.entityId), eq(bodyMeasurements.userId, userId)))
      .returning();
    if (!deleted) throw new Error('Measurement delete did not return a row.');
    return {
      operationId: operation.operationId,
      record: serializeMeasurement(deleted, true),
      status: 'applied',
    };
  }

  const mergedResult = bodyMeasurementCreatePayloadSchema.safeParse({
    additionalMeasurements:
      'additionalMeasurements' in operation.payload
        ? operation.payload.additionalMeasurements
        : current.additionalMeasurements,
    localDate: operation.payload.localDate ?? current.localDate,
    measuredAt: operation.payload.measuredAt ?? current.measuredAt.toISOString(),
    notes: 'notes' in operation.payload ? operation.payload.notes : current.notes,
    waistCm:
      'waistCm' in operation.payload
        ? operation.payload.waistCm
        : current.waistCm === null
          ? null
          : Number(current.waistCm),
    weightKg:
      'weightKg' in operation.payload
        ? operation.payload.weightKg
        : current.weightKg === null
          ? null
          : Number(current.weightKg),
  });
  if (!mergedResult.success) {
    return {
      errorCode: 'invalid_payload',
      operationId: operation.operationId,
      status: 'rejected',
    };
  }
  const merged = mergedResult.data;
  const [updated] = await transaction
    .update(bodyMeasurements)
    .set({
      additionalMeasurements: merged.additionalMeasurements ?? [],
      localDate: merged.localDate,
      measuredAt: new Date(merged.measuredAt),
      notes: merged.notes ?? null,
      waistCm: merged.waistCm?.toString() ?? null,
      weightKg: merged.weightKg?.toString() ?? null,
    })
    .where(and(eq(bodyMeasurements.id, operation.entityId), eq(bodyMeasurements.userId, userId)))
    .returning();
  if (!updated) throw new Error('Measurement update did not return a row.');
  return {
    operationId: operation.operationId,
    record: serializeMeasurement(updated),
    status: 'applied',
  };
}

function serializeExercise(row: typeof exercises.$inferSelect, tombstoneOnly = false): SyncRecord {
  const identity = {
    deletedAt: row.deletedAt?.toISOString() ?? null,
    id: row.id,
    version: row.version,
  };
  if (tombstoneOnly) return identity;
  return {
    ...identity,
    active: row.active,
    category: row.category,
    instructions: row.instructions,
    name: row.name,
    trackingMetric: row.trackingMetric,
  };
}

function serializePain(row: typeof painReports.$inferSelect, tombstoneOnly = false): SyncRecord {
  const identity = {
    deletedAt: row.deletedAt?.toISOString() ?? null,
    id: row.id,
    version: row.version,
  };
  if (tombstoneOnly) return identity;
  return {
    ...identity,
    bodyRegion: row.bodyRegion,
    customBodyRegion: row.customBodyRegion,
    exerciseId: row.exerciseId,
    exerciseSetId: row.exerciseSetId,
    exerciseStopped: row.exerciseStopped,
    intensity: row.intensity,
    localDate: row.localDate,
    moment: row.moment,
    notes: row.notes,
    occurredAt: row.occurredAt?.toISOString() ?? null,
    sessionId: row.sessionId,
    type: row.type,
  };
}

function serializeHabitEntry(
  row: typeof habitEntries.$inferSelect,
  tombstoneOnly = false,
): SyncRecord {
  const identity = {
    deletedAt: row.deletedAt?.toISOString() ?? null,
    id: row.id,
    version: row.version,
  };
  if (tombstoneOnly) return identity;
  return {
    ...identity,
    booleanValue: row.booleanValue,
    habitDefinitionId: row.habitDefinitionId,
    localDate: row.localDate,
    notes: row.notes,
    numericValue: row.numericValue === null ? null : Number(row.numericValue),
    selectedOptionId: row.selectedOptionId,
    textValue: row.textValue,
  };
}

async function applyPainOperation(
  transaction: SyncTransaction,
  userId: string,
  operation: SyncOperation,
): Promise<SyncPushResult> {
  if (operation.entityType !== 'pain_report') {
    return {
      errorCode: 'invalid_entity_handler',
      operationId: operation.operationId,
      status: 'rejected',
    };
  }
  const [current] = await transaction
    .select()
    .from(painReports)
    .where(and(eq(painReports.id, operation.entityId), eq(painReports.userId, userId)))
    .limit(1);
  if (operation.operation === 'create') {
    if (current) {
      return {
        errorCode: 'entity_already_exists',
        operationId: operation.operationId,
        record: serializePain(current),
        status: 'conflict',
      };
    }
    const [foreign] = await transaction
      .select({ id: painReports.id })
      .from(painReports)
      .where(eq(painReports.id, operation.entityId))
      .limit(1);
    if (foreign) return { operationId: operation.operationId, status: 'unauthorized' };
    if (operation.payload.sessionId) {
      const [session] = await transaction
        .select({ id: workoutSessions.id })
        .from(workoutSessions)
        .where(
          and(
            eq(workoutSessions.id, operation.payload.sessionId),
            eq(workoutSessions.userId, userId),
          ),
        )
        .limit(1);
      if (!session)
        return {
          errorCode: 'invalid_session_link',
          operationId: operation.operationId,
          status: 'rejected',
        };
    }
    if (operation.payload.exerciseSetId) {
      const [set] = await transaction
        .select({ id: exerciseSets.id })
        .from(exerciseSets)
        .where(
          and(
            eq(exerciseSets.id, operation.payload.exerciseSetId),
            eq(exerciseSets.userId, userId),
          ),
        )
        .limit(1);
      if (!set)
        return {
          errorCode: 'invalid_set_link',
          operationId: operation.operationId,
          status: 'rejected',
        };
    }
    const [created] = await transaction
      .insert(painReports)
      .values({
        ...operation.payload,
        id: operation.entityId,
        occurredAt: operation.payload.occurredAt ? new Date(operation.payload.occurredAt) : null,
        userId,
      })
      .returning();
    if (!created) throw new Error('Pain report insert did not return a row.');
    return {
      operationId: operation.operationId,
      record: serializePain(created),
      status: 'applied',
    };
  }
  if (!current)
    return {
      errorCode: 'entity_not_found',
      operationId: operation.operationId,
      status: 'rejected',
    };
  if (current.version !== operation.baseVersion || current.deletedAt) {
    return {
      errorCode: 'version_conflict',
      operationId: operation.operationId,
      record: serializePain(current, current.deletedAt !== null),
      status: 'conflict',
    };
  }
  if (operation.operation === 'delete') {
    const [deleted] = await transaction
      .update(painReports)
      .set({ deletedAt: new Date() })
      .where(and(eq(painReports.id, operation.entityId), eq(painReports.userId, userId)))
      .returning();
    if (!deleted) throw new Error('Pain report delete did not return a row.');
    return {
      operationId: operation.operationId,
      record: serializePain(deleted, true),
      status: 'applied',
    };
  }
  const [updated] = await transaction
    .update(painReports)
    .set({
      ...operation.payload,
      occurredAt: operation.payload.occurredAt ? new Date(operation.payload.occurredAt) : undefined,
    })
    .where(and(eq(painReports.id, operation.entityId), eq(painReports.userId, userId)))
    .returning();
  if (!updated) throw new Error('Pain report update did not return a row.');
  return { operationId: operation.operationId, record: serializePain(updated), status: 'applied' };
}

async function applyHabitDefinitionOperation(
  transaction: SyncTransaction,
  userId: string,
  operation: SyncOperation,
): Promise<SyncPushResult> {
  if (operation.entityType !== 'habit_definition') {
    return {
      errorCode: 'invalid_entity_handler',
      operationId: operation.operationId,
      status: 'rejected',
    };
  }
  const database = transaction as unknown as DatabaseClient;
  const current = await loadHabitDefinition(database, userId, operation.entityId);
  if (operation.operation === 'create') {
    if (current)
      return {
        errorCode: 'entity_already_exists',
        operationId: operation.operationId,
        record: { ...current, deletedAt: null },
        status: 'conflict',
      };
    const [foreign] = await transaction
      .select({ id: habitDefinitions.id })
      .from(habitDefinitions)
      .where(eq(habitDefinitions.id, operation.entityId))
      .limit(1);
    if (foreign) return { operationId: operation.operationId, status: 'unauthorized' };
    await insertHabitDefinition(database, userId, operation.payload, operation.entityId);
    const created = await loadHabitDefinition(database, userId, operation.entityId);
    if (!created) throw new Error('Habit definition insert did not return an aggregate.');
    return {
      operationId: operation.operationId,
      record: { ...created, deletedAt: null },
      status: 'applied',
    };
  }
  if (!current)
    return {
      errorCode: 'entity_not_found',
      operationId: operation.operationId,
      status: 'rejected',
    };
  if (current.version !== operation.baseVersion)
    return {
      errorCode: 'version_conflict',
      operationId: operation.operationId,
      record: { ...current, deletedAt: null },
      status: 'conflict',
    };
  if (operation.operation === 'delete') {
    const [deleted] = await transaction
      .update(habitDefinitions)
      .set({ active: false, deletedAt: new Date() })
      .where(and(eq(habitDefinitions.id, operation.entityId), eq(habitDefinitions.userId, userId)))
      .returning();
    if (!deleted) throw new Error('Habit definition delete did not return a row.');
    return {
      operationId: operation.operationId,
      record: {
        deletedAt: deleted.deletedAt?.toISOString() ?? null,
        id: deleted.id,
        version: deleted.version,
      },
      status: 'applied',
    };
  }
  const { options, ...changes } = operation.payload;
  await transaction
    .update(habitDefinitions)
    .set(changes)
    .where(and(eq(habitDefinitions.id, operation.entityId), eq(habitDefinitions.userId, userId)));
  if (options) {
    await reconcileHabitOptions(database, userId, operation.entityId, options);
  }
  const updated = await loadHabitDefinition(database, userId, operation.entityId);
  if (!updated) throw new Error('Habit definition update did not return an aggregate.');
  return {
    operationId: operation.operationId,
    record: { ...updated, deletedAt: null },
    status: 'applied',
  };
}

async function applyHabitEntryOperation(
  transaction: SyncTransaction,
  userId: string,
  operation: SyncOperation,
): Promise<SyncPushResult> {
  if (operation.entityType !== 'habit_entry') {
    return {
      errorCode: 'invalid_entity_handler',
      operationId: operation.operationId,
      status: 'rejected',
    };
  }
  const [current] = await transaction
    .select()
    .from(habitEntries)
    .where(and(eq(habitEntries.id, operation.entityId), eq(habitEntries.userId, userId)))
    .limit(1);
  if (operation.operation === 'create') {
    if (current)
      return {
        errorCode: 'entity_already_exists',
        operationId: operation.operationId,
        record: serializeHabitEntry(current),
        status: 'conflict',
      };
    const [sameDay] = await transaction
      .select()
      .from(habitEntries)
      .where(
        and(
          eq(habitEntries.userId, userId),
          eq(habitEntries.habitDefinitionId, operation.payload.habitDefinitionId),
          eq(habitEntries.localDate, operation.payload.localDate),
          isNull(habitEntries.deletedAt),
        ),
      )
      .limit(1);
    if (sameDay)
      return {
        errorCode: 'habit_entry_already_exists',
        operationId: operation.operationId,
        record: serializeHabitEntry(sameDay),
        status: 'conflict',
      };
    const [definition] = await transaction
      .select({ id: habitDefinitions.id })
      .from(habitDefinitions)
      .where(
        and(
          eq(habitDefinitions.id, operation.payload.habitDefinitionId),
          eq(habitDefinitions.userId, userId),
          isNull(habitDefinitions.deletedAt),
        ),
      )
      .limit(1);
    if (!definition)
      return {
        errorCode: 'habit_not_found',
        operationId: operation.operationId,
        status: 'rejected',
      };
    if (operation.payload.selectedOptionId) {
      const [option] = await transaction
        .select({ id: habitOptions.id })
        .from(habitOptions)
        .where(
          and(
            eq(habitOptions.id, operation.payload.selectedOptionId),
            eq(habitOptions.habitDefinitionId, operation.payload.habitDefinitionId),
            eq(habitOptions.userId, userId),
            isNull(habitOptions.deletedAt),
          ),
        )
        .limit(1);
      if (!option)
        return {
          errorCode: 'invalid_habit_option',
          operationId: operation.operationId,
          status: 'rejected',
        };
    }
    const [created] = await transaction
      .insert(habitEntries)
      .values({
        ...operation.payload,
        id: operation.entityId,
        numericValue: operation.payload.numericValue?.toString() ?? null,
        userId,
      })
      .returning();
    if (!created) throw new Error('Habit entry insert did not return a row.');
    return {
      operationId: operation.operationId,
      record: serializeHabitEntry(created),
      status: 'applied',
    };
  }
  if (!current)
    return {
      errorCode: 'entity_not_found',
      operationId: operation.operationId,
      status: 'rejected',
    };
  if (current.version !== operation.baseVersion || current.deletedAt)
    return {
      errorCode: 'version_conflict',
      operationId: operation.operationId,
      record: serializeHabitEntry(current, current.deletedAt !== null),
      status: 'conflict',
    };
  if (operation.operation === 'delete') {
    const [deleted] = await transaction
      .update(habitEntries)
      .set({ deletedAt: new Date() })
      .where(and(eq(habitEntries.id, operation.entityId), eq(habitEntries.userId, userId)))
      .returning();
    if (!deleted) throw new Error('Habit entry delete did not return a row.');
    return {
      operationId: operation.operationId,
      record: serializeHabitEntry(deleted, true),
      status: 'applied',
    };
  }
  if (operation.payload.selectedOptionId) {
    const [option] = await transaction
      .select({ id: habitOptions.id })
      .from(habitOptions)
      .where(
        and(
          eq(habitOptions.id, operation.payload.selectedOptionId),
          eq(habitOptions.habitDefinitionId, current.habitDefinitionId),
          eq(habitOptions.userId, userId),
          isNull(habitOptions.deletedAt),
        ),
      )
      .limit(1);
    if (!option)
      return {
        errorCode: 'invalid_habit_option',
        operationId: operation.operationId,
        status: 'rejected',
      };
  }
  const changesValue = ['booleanValue', 'numericValue', 'selectedOptionId', 'textValue'].some(
    (key) => key in operation.payload,
  );
  const [updated] = await transaction
    .update(habitEntries)
    .set({
      ...operation.payload,
      booleanValue: changesValue ? (operation.payload.booleanValue ?? null) : undefined,
      numericValue: changesValue ? (operation.payload.numericValue?.toString() ?? null) : undefined,
      selectedOptionId: changesValue ? (operation.payload.selectedOptionId ?? null) : undefined,
      textValue: changesValue ? (operation.payload.textValue ?? null) : undefined,
    })
    .where(and(eq(habitEntries.id, operation.entityId), eq(habitEntries.userId, userId)))
    .returning();
  if (!updated) throw new Error('Habit entry update did not return a row.');
  return {
    operationId: operation.operationId,
    record: serializeHabitEntry(updated),
    status: 'applied',
  };
}

async function applyExerciseOperation(
  transaction: SyncTransaction,
  userId: string,
  operation: SyncOperation,
): Promise<SyncPushResult> {
  if (operation.entityType !== 'exercise') {
    return {
      errorCode: 'invalid_entity_handler',
      operationId: operation.operationId,
      status: 'rejected',
    };
  }
  const [current] = await transaction
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, operation.entityId), eq(exercises.userId, userId)))
    .limit(1);
  if (operation.operation === 'create') {
    if (current) {
      return {
        errorCode: 'entity_already_exists',
        operationId: operation.operationId,
        record: serializeExercise(current),
        status: 'conflict',
      };
    }
    const [foreign] = await transaction
      .select({ id: exercises.id })
      .from(exercises)
      .where(eq(exercises.id, operation.entityId))
      .limit(1);
    if (foreign) return { operationId: operation.operationId, status: 'unauthorized' };
    const { id: payloadId, ...payload } = operation.payload;
    void payloadId;
    const [created] = await transaction
      .insert(exercises)
      .values({ ...payload, id: operation.entityId, isSystem: false, userId })
      .returning();
    if (!created) throw new Error('Exercise insert did not return a row.');
    return {
      operationId: operation.operationId,
      record: serializeExercise(created),
      status: 'applied',
    };
  }
  if (!current)
    return {
      errorCode: 'entity_not_found',
      operationId: operation.operationId,
      status: 'rejected',
    };
  if (current.version !== operation.baseVersion || current.deletedAt) {
    return {
      errorCode: 'version_conflict',
      operationId: operation.operationId,
      record: serializeExercise(current, current.deletedAt !== null),
      status: 'conflict',
    };
  }
  if (operation.operation === 'delete') {
    const [deleted] = await transaction
      .update(exercises)
      .set({ active: false, deletedAt: new Date() })
      .where(and(eq(exercises.id, operation.entityId), eq(exercises.userId, userId)))
      .returning();
    if (!deleted) throw new Error('Exercise delete did not return a row.');
    return {
      operationId: operation.operationId,
      record: serializeExercise(deleted, true),
      status: 'applied',
    };
  }
  const [updated] = await transaction
    .update(exercises)
    .set(operation.payload)
    .where(and(eq(exercises.id, operation.entityId), eq(exercises.userId, userId)))
    .returning();
  if (!updated) throw new Error('Exercise update did not return a row.');
  return {
    operationId: operation.operationId,
    record: serializeExercise(updated),
    status: 'applied',
  };
}

function serializePlan(row: typeof trainingPlans.$inferSelect, tombstoneOnly = false): SyncRecord {
  const identity = {
    deletedAt: row.deletedAt?.toISOString() ?? null,
    id: row.id,
    version: row.version,
  };
  if (tombstoneOnly) return identity;
  return {
    ...identity,
    name: row.name,
    status: row.status,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
  };
}

async function applyPlanOperation(
  transaction: SyncTransaction,
  userId: string,
  operation: SyncOperation,
): Promise<SyncPushResult> {
  if (operation.entityType !== 'training_plan') {
    return {
      errorCode: 'invalid_entity_handler',
      operationId: operation.operationId,
      status: 'rejected',
    };
  }
  const [current] = await transaction
    .select()
    .from(trainingPlans)
    .where(and(eq(trainingPlans.id, operation.entityId), eq(trainingPlans.userId, userId)))
    .limit(1);
  if (operation.operation === 'create') {
    if (current) {
      return {
        errorCode: 'entity_already_exists',
        operationId: operation.operationId,
        record: serializePlan(current),
        status: 'conflict',
      };
    }
    const [foreign] = await transaction
      .select({ id: trainingPlans.id })
      .from(trainingPlans)
      .where(eq(trainingPlans.id, operation.entityId))
      .limit(1);
    if (foreign) return { operationId: operation.operationId, status: 'unauthorized' };
    const { id: payloadId, ...payload } = operation.payload;
    void payloadId;
    const [created] = await transaction
      .insert(trainingPlans)
      .values({
        ...payload,
        id: operation.entityId,
        validUntil: payload.validUntil ?? null,
        userId,
      })
      .returning();
    if (!created) throw new Error('Plan insert did not return a row.');
    return {
      operationId: operation.operationId,
      record: serializePlan(created),
      status: 'applied',
    };
  }
  if (!current)
    return {
      errorCode: 'entity_not_found',
      operationId: operation.operationId,
      status: 'rejected',
    };
  if (current.version !== operation.baseVersion || current.deletedAt) {
    return {
      errorCode: 'version_conflict',
      operationId: operation.operationId,
      record: serializePlan(current, current.deletedAt !== null),
      status: 'conflict',
    };
  }
  if (operation.operation === 'delete') {
    const [deleted] = await transaction
      .update(trainingPlans)
      .set({ deletedAt: new Date(), status: 'archived' })
      .where(and(eq(trainingPlans.id, operation.entityId), eq(trainingPlans.userId, userId)))
      .returning();
    if (!deleted) throw new Error('Plan delete did not return a row.');
    return {
      operationId: operation.operationId,
      record: serializePlan(deleted, true),
      status: 'applied',
    };
  }
  const { effectiveFrom, ...payload } = operation.payload;
  void effectiveFrom;
  const [updated] = await transaction
    .update(trainingPlans)
    .set(payload)
    .where(and(eq(trainingPlans.id, operation.entityId), eq(trainingPlans.userId, userId)))
    .returning();
  if (!updated) throw new Error('Plan update did not return a row.');
  return { operationId: operation.operationId, record: serializePlan(updated), status: 'applied' };
}

async function planningReferenceError(
  transaction: SyncTransaction,
  userId: string,
  planId: string,
  exerciseIds: string[],
): Promise<string | null> {
  const [plan] = await transaction
    .select({ id: trainingPlans.id })
    .from(trainingPlans)
    .where(
      and(
        eq(trainingPlans.id, planId),
        eq(trainingPlans.userId, userId),
        isNull(trainingPlans.deletedAt),
      ),
    )
    .limit(1);
  if (!plan) return 'plan_not_found';
  if (exerciseIds.length === 0) return null;
  const available = await transaction
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
  return new Set(available.map((row) => row.id)).size === new Set(exerciseIds).size
    ? null
    : 'exercise_unavailable';
}

async function applyTemplateOperation(
  transaction: SyncTransaction,
  userId: string,
  operation: SyncOperation,
): Promise<SyncPushResult> {
  if (operation.entityType !== 'workout_template') {
    return {
      errorCode: 'invalid_entity_handler',
      operationId: operation.operationId,
      status: 'rejected',
    };
  }
  const database = transaction as unknown as DatabaseClient;
  const current = await loadTemplate(database, userId, operation.entityId);
  if (operation.operation === 'create') {
    if (current) {
      return {
        errorCode: 'entity_already_exists',
        operationId: operation.operationId,
        record: { ...current, deletedAt: null },
        status: 'conflict',
      };
    }
    const [foreign] = await transaction
      .select({ id: workoutTemplates.id })
      .from(workoutTemplates)
      .where(eq(workoutTemplates.id, operation.entityId))
      .limit(1);
    if (foreign) return { operationId: operation.operationId, status: 'unauthorized' };
    const referenceError = await planningReferenceError(
      transaction,
      userId,
      operation.payload.planId,
      operation.payload.exercises.map((item) => item.exerciseId),
    );
    if (referenceError) {
      return { errorCode: referenceError, operationId: operation.operationId, status: 'rejected' };
    }
    await insertTemplateAggregate(database, userId, operation.payload, operation.entityId);
    const created = await loadTemplate(database, userId, operation.entityId);
    if (!created) throw new Error('Template insert did not return an aggregate.');
    return {
      operationId: operation.operationId,
      record: { ...created, deletedAt: null },
      status: 'applied',
    };
  }
  if (!current)
    return {
      errorCode: 'entity_not_found',
      operationId: operation.operationId,
      status: 'rejected',
    };
  if (current.version !== operation.baseVersion) {
    return {
      errorCode: 'version_conflict',
      operationId: operation.operationId,
      record: { ...current, deletedAt: null },
      status: 'conflict',
    };
  }
  if (operation.operation === 'delete') {
    const [deleted] = await transaction
      .update(workoutTemplates)
      .set({ deletedAt: new Date() })
      .where(and(eq(workoutTemplates.id, operation.entityId), eq(workoutTemplates.userId, userId)))
      .returning({
        deletedAt: workoutTemplates.deletedAt,
        id: workoutTemplates.id,
        version: workoutTemplates.version,
      });
    if (!deleted) throw new Error('Template delete did not return a row.');
    return {
      operationId: operation.operationId,
      record: {
        deletedAt: deleted.deletedAt?.toISOString() ?? null,
        id: deleted.id,
        version: deleted.version,
      },
      status: 'applied',
    };
  }
  const referenceError = await planningReferenceError(
    transaction,
    userId,
    operation.payload.planId,
    operation.payload.exercises.map((item) => item.exerciseId),
  );
  if (referenceError) {
    return { errorCode: referenceError, operationId: operation.operationId, status: 'rejected' };
  }
  await transaction
    .delete(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.templateId, operation.entityId),
        eq(workoutSessions.status, 'planned'),
        gte(workoutSessions.plannedLocalDate, operation.payload.effectiveFrom),
      ),
    );
  await transaction.delete(scheduleRules).where(eq(scheduleRules.templateId, operation.entityId));
  await transaction
    .delete(workoutTemplateExercises)
    .where(eq(workoutTemplateExercises.templateId, operation.entityId));
  await transaction
    .update(workoutTemplates)
    .set({
      name: operation.payload.name,
      notes: operation.payload.notes ?? null,
      planId: operation.payload.planId,
      type: operation.payload.type,
    })
    .where(and(eq(workoutTemplates.id, operation.entityId), eq(workoutTemplates.userId, userId)));
  for (const exercise of operation.payload.exercises) {
    const templateExerciseId = exercise.id ?? randomUUID();
    await transaction.insert(workoutTemplateExercises).values({
      exerciseId: exercise.exerciseId,
      id: templateExerciseId,
      notes: exercise.notes ?? null,
      sortOrder: exercise.sortOrder,
      templateId: operation.entityId,
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
  if (operation.payload.rules.length > 0) {
    await transaction.insert(scheduleRules).values(
      operation.payload.rules.map((rule) => ({
        id: rule.id,
        localTime: rule.localTime,
        templateId: operation.entityId,
        timeZone: rule.timeZone,
        userId,
        validFrom: rule.validFrom,
        validUntil: rule.validUntil ?? null,
        weekday: rule.weekday,
      })),
    );
  }
  const updated = await loadTemplate(database, userId, operation.entityId);
  if (!updated) throw new Error('Template update did not return an aggregate.');
  return {
    operationId: operation.operationId,
    record: { ...updated, deletedAt: null },
    status: 'applied',
  };
}

async function applySessionOperation(
  transaction: SyncTransaction,
  userId: string,
  operation: SyncOperation,
): Promise<SyncPushResult> {
  if (operation.entityType !== 'workout_session') {
    return {
      errorCode: 'invalid_entity_handler',
      operationId: operation.operationId,
      status: 'rejected',
    };
  }
  const database = transaction as unknown as DatabaseClient;
  const current = await loadSession(database, userId, operation.entityId);
  if (operation.operation === 'create') {
    if (current) {
      return {
        errorCode: 'entity_already_exists',
        operationId: operation.operationId,
        record: { ...current, deletedAt: null },
        status: 'conflict',
      };
    }
    const [foreign] = await transaction
      .select({ id: workoutSessions.id })
      .from(workoutSessions)
      .where(eq(workoutSessions.id, operation.entityId))
      .limit(1);
    if (foreign) return { operationId: operation.operationId, status: 'unauthorized' };
    await insertSessionAggregate(database, userId, operation.payload, operation.entityId);
    const created = operation.payload.execution
      ? await applySessionExecution(database, userId, operation.entityId, {
          execution: operation.payload.execution,
          notes: operation.payload.notes,
          version: 1,
        })
      : await loadSession(database, userId, operation.entityId);
    if (!created) throw new Error('Session insert did not return an aggregate.');
    return {
      operationId: operation.operationId,
      record: { ...created, deletedAt: null },
      status: 'applied',
    };
  }
  if (!current)
    return {
      errorCode: 'entity_not_found',
      operationId: operation.operationId,
      status: 'rejected',
    };
  if (current.version !== operation.baseVersion) {
    return {
      errorCode: 'version_conflict',
      operationId: operation.operationId,
      record: { ...current, deletedAt: null },
      status: 'conflict',
    };
  }
  if (operation.operation === 'delete') {
    if (current.status !== 'planned') {
      return {
        errorCode: 'session_history_immutable',
        operationId: operation.operationId,
        status: 'rejected',
      };
    }
    const [deleted] = await transaction
      .update(workoutSessions)
      .set({ deletedAt: new Date() })
      .where(and(eq(workoutSessions.id, operation.entityId), eq(workoutSessions.userId, userId)))
      .returning({
        deletedAt: workoutSessions.deletedAt,
        id: workoutSessions.id,
        version: workoutSessions.version,
      });
    if (!deleted) throw new Error('Session delete did not return a row.');
    return {
      operationId: operation.operationId,
      record: {
        deletedAt: deleted.deletedAt?.toISOString() ?? null,
        id: deleted.id,
        version: deleted.version,
      },
      status: 'applied',
    };
  }
  let updated;
  try {
    updated = await updatePlannedAdHocSession(database, userId, operation.entityId, {
      ...operation.payload,
      version: operation.baseVersion,
    });
  } catch (error) {
    if (error instanceof ApiHttpError && error.statusCode === 409) {
      return { errorCode: error.code, operationId: operation.operationId, status: 'rejected' };
    }
    throw error;
  }
  if (!updated) throw new Error('Session update did not return an aggregate.');
  return {
    operationId: operation.operationId,
    record: { ...updated, deletedAt: null },
    status: 'applied',
  };
}

const entityHandlers = {
  body_measurement: applyMeasurementOperation,
  exercise: applyExerciseOperation,
  habit_definition: applyHabitDefinitionOperation,
  habit_entry: applyHabitEntryOperation,
  pain_report: applyPainOperation,
  training_plan: applyPlanOperation,
  workout_session: applySessionOperation,
  workout_template: applyTemplateOperation,
} satisfies Record<
  SyncOperation['entityType'],
  (
    transaction: SyncTransaction,
    userId: string,
    operation: SyncOperation,
  ) => Promise<SyncPushResult>
>;

async function processOperation(
  database: DatabaseClient,
  userId: string,
  operation: SyncOperation,
): Promise<SyncPushResult> {
  if (!(await ensureDevice(database, userId, operation.deviceId))) {
    return { operationId: operation.operationId, status: 'unauthorized' };
  }
  return database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${operation.operationId}`}, 0))`,
    );
    const [previous] = await transaction
      .select({ response: syncOperations.response })
      .from(syncOperations)
      .where(
        and(
          eq(syncOperations.userId, userId),
          eq(syncOperations.operationId, operation.operationId),
        ),
      )
      .limit(1);
    if (previous) {
      return { ...(previous.response as SyncPushResult), status: 'duplicate' };
    }

    const result = await entityHandlers[operation.entityType](transaction, userId, operation);
    await transaction.insert(syncOperations).values({
      baseVersion: operation.baseVersion,
      clientOccurredAt: new Date(operation.clientOccurredAt),
      deviceId: operation.deviceId,
      entityId: operation.entityId,
      entityType: operation.entityType,
      errorCode: result.errorCode,
      operation: operation.operation,
      operationId: operation.operationId,
      response: result,
      result: result.status,
      userId,
    });
    if (result.status === 'applied' && result.record) {
      await transaction.insert(changeLog).values({
        deletedAt:
          typeof result.record.deletedAt === 'string' ? new Date(result.record.deletedAt) : null,
        entityId: operation.entityId,
        entityType: operation.entityType,
        operation: operation.operation,
        payload: result.record,
        userId,
        version: result.record.version,
      });
    }
    return result;
  });
}

export function registerSyncRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  app.post('/api/v1/sync/push', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const batch = syncPushRequestSchema.safeParse(request.body);
    if (!batch.success) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Lote de sincronização inválido.');
    }
    const results: SyncPushResult[] = [];
    for (const candidate of batch.data.operations) {
      const parsed = syncOperationSchema.safeParse(candidate);
      if (!parsed.success) {
        const possibleId =
          typeof candidate === 'object' && candidate !== null && 'operationId' in candidate
            ? z.uuid().safeParse(candidate.operationId)
            : null;
        results.push({
          errorCode: 'invalid_operation',
          operationId: possibleId?.success ? possibleId.data : null,
          status: 'rejected',
        });
        continue;
      }
      const result = await processOperation(dependencies.database, user.id, parsed.data);
      results.push(result);
      if (result.status === 'applied' || result.status === 'duplicate') {
        if (parsed.data.entityType === 'workout_session') {
          await evaluateProgressionForSession(dependencies.database, user.id, parsed.data.entityId);
        } else if (parsed.data.entityType === 'pain_report') {
          const sessionId = result.record?.sessionId;
          if (typeof sessionId === 'string') {
            await evaluateProgressionForSession(dependencies.database, user.id, sessionId, true);
          }
        }
      }
    }
    return { results };
  });

  app.get('/api/v1/sync/pull', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const url = new URL(request.url, dependencies.trustedOrigins[0] ?? 'http://localhost');
    const parsed = pullQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Consulta de sincronização inválida.');
    }
    const sequence = decodeCursor(parsed.data.cursor);
    const rows = await dependencies.database
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.userId, user.id), gt(changeLog.sequence, sequence)))
      .orderBy(asc(changeLog.sequence))
      .limit(parsed.data.limit + 1);
    const hasMore = rows.length > parsed.data.limit;
    const page = rows.slice(0, parsed.data.limit);
    const lastSequence = page.at(-1)?.sequence ?? sequence;
    return {
      changes: page.map((row) => ({
        changedAt: row.changedAt.toISOString(),
        deletedAt: row.deletedAt?.toISOString() ?? null,
        entityId: row.entityId,
        entityType: row.entityType,
        operation: row.operation === 'resolve' ? ('update' as const) : row.operation,
        payload: row.payload,
        sequence: row.sequence,
        version: row.version,
      })),
      cursor: lastSequence > 0 ? encodeCursor(lastSequence) : null,
      hasMore,
      serverTime: new Date().toISOString(),
    };
  });
}
