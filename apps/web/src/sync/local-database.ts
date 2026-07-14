import type { ProgressAnalyticsResponse, SyncEntityType, SyncOperation } from '@torkout/contracts';
import Dexie, { type EntityTable } from 'dexie';

export type LocalSyncStatus = 'conflict' | 'pending' | 'saved-local' | 'synced';
export type OutboxState = 'conflict' | 'failed' | 'pending' | 'sending';

export interface LocalRecord {
  data: Record<string, unknown>;
  deletedAt: string | null;
  entityId: string;
  entityType: SyncEntityType;
  key: string;
  syncStatus: LocalSyncStatus;
  updatedAt: string;
  version: number;
}

export type OutboxEntry = SyncOperation & {
  attempts: number;
  lastError: string | null;
  state: OutboxState;
};

export interface LocalConflict {
  entityId: string;
  entityType: SyncEntityType;
  id: string;
  localPayload: Record<string, unknown>;
  operationId: string;
  serverRecord: Record<string, unknown>;
}

export interface SyncMetadata {
  key: 'cursor' | 'deviceId';
  value: string | null;
}

export interface AnalyticsCacheEntry {
  cachedAt: string;
  from: string;
  key: string;
  response: ProgressAnalyticsResponse;
  through: string;
}

export class UserSyncDatabase extends Dexie {
  analyticsCache!: EntityTable<AnalyticsCacheEntry, 'key'>;
  conflicts!: EntityTable<LocalConflict, 'id'>;
  metadata!: EntityTable<SyncMetadata, 'key'>;
  outbox!: EntityTable<OutboxEntry, 'operationId'>;
  records!: EntityTable<LocalRecord, 'key'>;

  constructor(readonly userId: string) {
    super(databaseName(userId));
    this.version(1).stores({
      conflicts: 'id, [entityType+entityId], operationId',
      metadata: 'key',
      outbox: 'operationId, state, clientOccurredAt, [entityType+entityId]',
      records: 'key, entityType, syncStatus, deletedAt',
    });
    this.version(2).stores({
      analyticsCache: 'key, cachedAt, [from+through]',
      conflicts: 'id, [entityType+entityId], operationId',
      metadata: 'key',
      outbox: 'operationId, state, clientOccurredAt, [entityType+entityId]',
      records: 'key, entityType, syncStatus, deletedAt',
    });
  }
}

function databaseName(userId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId)) {
    throw new Error('Identificador de usuário inválido para a réplica local.');
  }
  return `torkout-replica-v1-${userId}`;
}

export function entityKey(entityType: SyncEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function createUserSyncDatabase(userId: string): UserSyncDatabase {
  return new UserSyncDatabase(userId);
}

export async function deleteUserSyncDatabase(userId: string): Promise<void> {
  await Dexie.delete(databaseName(userId));
}

export async function getOrCreateDeviceId(database: UserSyncDatabase): Promise<string> {
  const existing = await database.metadata.get('deviceId');
  if (existing?.value) return existing.value;
  const deviceId = crypto.randomUUID();
  await database.metadata.put({ key: 'deviceId', value: deviceId });
  return deviceId;
}

type MutationInput =
  | {
      entityId: string;
      entityType: SyncEntityType;
      operation: 'create';
      payload: Record<string, unknown>;
    }
  | {
      baseVersion?: number;
      entityId: string;
      entityType: SyncEntityType;
      operation: 'delete' | 'update';
      payload: Record<string, unknown>;
    };

export async function queueLocalMutation(
  database: UserSyncDatabase,
  input: MutationInput,
  now = new Date(),
): Promise<OutboxEntry> {
  const operationId = crypto.randomUUID();
  const deviceId = await getOrCreateDeviceId(database);
  const key = entityKey(input.entityType, input.entityId);
  let created!: OutboxEntry;

  await database.transaction('rw', database.records, database.outbox, async () => {
    const current = await database.records.get(key);
    const queued = await database.outbox
      .where('[entityType+entityId]')
      .equals([input.entityType, input.entityId])
      .filter((entry) => entry.state === 'pending')
      .last();
    if (queued && input.operation === 'update' && queued.operation !== 'delete') {
      const data = { ...current?.data, ...input.payload };
      created = {
        ...queued,
        payload: { ...queued.payload, ...input.payload },
      } as OutboxEntry;
      await database.records.put({
        data,
        deletedAt: null,
        entityId: input.entityId,
        entityType: input.entityType,
        key,
        syncStatus: 'pending',
        updatedAt: now.toISOString(),
        version: current?.version ?? 0,
      });
      await database.outbox.put(created);
      return;
    }
    const baseVersion =
      input.operation === 'create' ? null : (input.baseVersion ?? current?.version);
    if (input.operation !== 'create' && (!baseVersion || baseVersion < 1)) {
      throw new Error('A mutação exige uma versão sincronizada como base.');
    }
    const data =
      input.operation === 'update' ? { ...current?.data, ...input.payload } : input.payload;
    const deletedAt = input.operation === 'delete' ? now.toISOString() : null;
    await database.records.put({
      data,
      deletedAt,
      entityId: input.entityId,
      entityType: input.entityType,
      key,
      syncStatus: 'pending',
      updatedAt: now.toISOString(),
      version: baseVersion ?? 0,
    });
    created = {
      attempts: 0,
      baseVersion,
      clientOccurredAt: now.toISOString(),
      deviceId,
      entityId: input.entityId,
      entityType: input.entityType,
      lastError: null,
      operation: input.operation,
      operationId,
      payload: input.operation === 'delete' ? {} : input.payload,
      state: 'pending',
    } as OutboxEntry;
    await database.outbox.add(created);
  });
  return created;
}

export async function pruneLocalTombstones(
  database: UserSyncDatabase,
  now = new Date(),
  retentionDays = 90,
): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000).toISOString();
  const expired = await database.records
    .filter(
      (record) =>
        record.syncStatus === 'synced' && record.deletedAt !== null && record.deletedAt < cutoff,
    )
    .primaryKeys();
  await database.records.bulkDelete(expired);
  return expired.length;
}
