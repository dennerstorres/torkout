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
  type DatabaseClient,
  registeredDevices,
  syncOperations,
} from '@torkout/database';
import { createHash } from 'node:crypto';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ApiHttpError, type ApiDependencies, requireAuthenticatedUser } from './auth-routes.js';

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

const entityHandlers = {
  body_measurement: applyMeasurementOperation,
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
      results.push(await processOperation(dependencies.database, user.id, parsed.data));
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
      .where(
        and(
          eq(changeLog.userId, user.id),
          eq(changeLog.entityType, 'body_measurement'),
          gt(changeLog.sequence, sequence),
        ),
      )
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
        entityType: 'body_measurement' as const,
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
