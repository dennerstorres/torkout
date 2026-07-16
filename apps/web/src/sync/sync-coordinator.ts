import type {
  SyncChange,
  SyncOperation,
  SyncPullResponse,
  SyncPushResponse,
} from '@torkout/contracts';

import {
  entityKey,
  type LocalConflict,
  type OutboxEntry,
  pruneLocalTombstones,
  queueLocalMutation,
  type UserSyncDatabase,
} from './local-database';

export type SyncState =
  'auth-required' | 'conflict' | 'error' | 'offline' | 'pending' | 'synced' | 'syncing';

export interface SyncSnapshot {
  conflictCount: number;
  lastError: string | null;
  pendingCount: number;
  state: SyncState;
}

export interface SyncTransport {
  pull(input: { cursor: string | null }): Promise<SyncPullResponse>;
  push(input: { operations: SyncOperation[] }): Promise<SyncPushResponse>;
}

type Listener = (snapshot: SyncSnapshot) => void;

const MAX_PUSH_BATCH_SIZE = 50;

function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: unknown }).status)
    : undefined;
}

function operationForTransport(entry: OutboxEntry): SyncOperation {
  const operation = {
    baseVersion: entry.baseVersion,
    clientOccurredAt: entry.clientOccurredAt,
    deviceId: entry.deviceId,
    entityId: entry.entityId,
    entityType: entry.entityType,
    operation: entry.operation,
    operationId: entry.operationId,
    payload: entry.payload,
  };
  return operation as SyncOperation;
}

export class SyncCoordinator {
  private current: SyncSnapshot = {
    conflictCount: 0,
    lastError: null,
    pendingCount: 0,
    state: 'synced',
  };
  private readonly listeners = new Set<Listener>();
  private running: Promise<void> | null = null;

  constructor(
    private readonly database: UserSyncDatabase,
    private readonly transport: SyncTransport,
    private readonly options: { isOnline(): boolean } = { isOnline: () => navigator.onLine },
  ) {}

  snapshot(): SyncSnapshot {
    return this.current;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  private publish(next: Partial<SyncSnapshot>): void {
    this.current = { ...this.current, ...next };
    this.listeners.forEach((listener) => listener(this.current));
  }

  private async refreshCounts(state?: SyncState): Promise<void> {
    const [pendingCount, conflictCount] = await Promise.all([
      this.database.outbox.where('state').anyOf('pending', 'sending', 'conflict').count(),
      this.database.conflicts.count(),
    ]);
    this.publish({ conflictCount, pendingCount, ...(state ? { state } : {}) });
  }

  async sync(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.performSync().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async performSync(): Promise<void> {
    if (!this.options.isOnline()) {
      await this.refreshCounts('offline');
      return;
    }
    await this.refreshCounts('syncing');
    const pending = await this.database.outbox
      .where('state')
      .equals('pending')
      .sortBy('clientOccurredAt');
    for (let offset = 0; offset < pending.length; offset += MAX_PUSH_BATCH_SIZE) {
      const batch = pending.slice(offset, offset + MAX_PUSH_BATCH_SIZE);
      await this.database.outbox.bulkUpdate(
        batch.map((item) => ({ key: item.operationId, changes: { state: 'sending' } })),
      );
      let response: SyncPushResponse;
      try {
        response = await this.transport.push({
          operations: batch.map(operationForTransport),
        });
      } catch (error) {
        await this.restoreAfterTransportFailure(batch, error);
        return;
      }
      await this.applyPushResults(batch, response);
    }

    try {
      await this.pullAllPages();
      await pruneLocalTombstones(this.database);
    } catch (error) {
      if (statusOf(error) === 401) {
        await this.refreshCounts('auth-required');
      } else {
        this.publish({ lastError: 'Falha ao receber alterações.', state: 'error' });
        await this.refreshCounts();
      }
      return;
    }
    const conflicts = await this.database.conflicts.count();
    const remaining = await this.database.outbox
      .where('state')
      .anyOf('pending', 'conflict')
      .count();
    await this.refreshCounts(conflicts > 0 ? 'conflict' : remaining > 0 ? 'pending' : 'synced');
    this.publish({ lastError: null });
  }

  private async restoreAfterTransportFailure(
    pending: OutboxEntry[],
    error: unknown,
  ): Promise<void> {
    await this.database.outbox.bulkUpdate(
      pending.map((item) => ({
        changes: {
          attempts: item.attempts + 1,
          lastError: statusOf(error) === 401 ? 'authentication_required' : 'network_error',
          state: 'pending',
        },
        key: item.operationId,
      })),
    );
    await this.refreshCounts(statusOf(error) === 401 ? 'auth-required' : 'error');
    if (statusOf(error) !== 401) this.publish({ lastError: 'Falha de conexão; nada foi perdido.' });
  }

  private async applyPushResults(
    pending: OutboxEntry[],
    response: SyncPushResponse,
  ): Promise<void> {
    const byId = new Map(pending.map((item) => [item.operationId, item]));
    for (const result of response.results) {
      if (!result.operationId) continue;
      const operation = byId.get(result.operationId);
      if (!operation) continue;
      const key = entityKey(operation.entityType, operation.entityId);
      if (result.status === 'applied' || result.status === 'duplicate') {
        await this.database.transaction(
          'rw',
          this.database.outbox,
          this.database.records,
          async () => {
            await this.database.outbox.delete(operation.operationId);
            if (result.record) {
              await this.database.records.put({
                data: result.record,
                deletedAt:
                  typeof result.record.deletedAt === 'string' ? result.record.deletedAt : null,
                entityId: operation.entityId,
                entityType: operation.entityType,
                key,
                syncStatus: 'synced',
                updatedAt: new Date().toISOString(),
                version: result.record.version,
              });
            }
          },
        );
      } else if (result.status === 'conflict' && result.record) {
        const conflict: LocalConflict = {
          entityId: operation.entityId,
          entityType: operation.entityType,
          id: `conflict:${operation.operationId}`,
          localPayload: operation.payload,
          operationId: operation.operationId,
          serverRecord: result.record,
        };
        await this.database.transaction(
          'rw',
          this.database.conflicts,
          this.database.outbox,
          this.database.records,
          async () => {
            await this.database.conflicts.put(conflict);
            await this.database.outbox.update(operation.operationId, {
              lastError: result.errorCode ?? 'version_conflict',
              state: 'conflict',
            });
            await this.database.records.update(key, { syncStatus: 'conflict' });
          },
        );
      } else {
        await this.database.outbox.update(operation.operationId, {
          attempts: operation.attempts + 1,
          lastError: result.errorCode ?? result.status,
          state: result.status === 'unauthorized' ? 'pending' : 'failed',
        });
      }
    }
  }

  private async pullAllPages(): Promise<void> {
    let cursor = (await this.database.metadata.get('cursor'))?.value ?? null;
    let hasMore = true;
    while (hasMore) {
      const page = await this.transport.pull({ cursor });
      await this.database.transaction(
        'rw',
        this.database.records,
        this.database.conflicts,
        this.database.metadata,
        async () => {
          for (const change of page.changes) await this.applyRemoteChange(change);
          await this.database.metadata.put({ key: 'cursor', value: page.cursor });
        },
      );
      cursor = page.cursor;
      hasMore = page.hasMore;
    }
  }

  private async applyRemoteChange(change: SyncChange): Promise<void> {
    const key = entityKey(change.entityType, change.entityId);
    const current = await this.database.records.get(key);
    if (current && current.version >= change.version) return;
    if (current?.syncStatus === 'pending' || current?.syncStatus === 'conflict') {
      await this.database.conflicts.put({
        entityId: change.entityId,
        entityType: change.entityType,
        id: `remote:${change.entityType}:${change.entityId}:${change.version}`,
        localPayload: current.data,
        operationId: '',
        serverRecord: change.payload,
      });
      await this.database.records.update(key, { syncStatus: 'conflict' });
      return;
    }
    await this.database.records.put({
      data: change.payload,
      deletedAt: change.deletedAt,
      entityId: change.entityId,
      entityType: change.entityType,
      key,
      syncStatus: 'synced',
      updatedAt: change.changedAt,
      version: change.version,
    });
  }

  async retryFailed(): Promise<void> {
    await this.database.outbox.where('state').equals('failed').modify({ state: 'pending' });
    await this.sync();
  }

  async exportPending(): Promise<string> {
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), operations: await this.database.outbox.toArray() },
      null,
      2,
    );
  }

  async listConflicts(): Promise<LocalConflict[]> {
    return this.database.conflicts.toArray();
  }

  async resolveConflict(conflictId: string, choice: 'local' | 'server'): Promise<void> {
    const conflict = await this.database.conflicts.get(conflictId);
    if (!conflict) return;
    const key = entityKey(conflict.entityType, conflict.entityId);
    if (choice === 'local') {
      const version = Number(conflict.serverRecord.version);
      await queueLocalMutation(this.database, {
        baseVersion: version,
        entityId: conflict.entityId,
        entityType: conflict.entityType,
        operation: 'update',
        payload: conflict.localPayload,
      });
    } else {
      await this.database.records.put({
        data: conflict.serverRecord,
        deletedAt:
          typeof conflict.serverRecord.deletedAt === 'string'
            ? conflict.serverRecord.deletedAt
            : null,
        entityId: conflict.entityId,
        entityType: conflict.entityType,
        key,
        syncStatus: 'synced',
        updatedAt: new Date().toISOString(),
        version: Number(conflict.serverRecord.version),
      });
    }
    if (conflict.operationId) await this.database.outbox.delete(conflict.operationId);
    await this.database.conflicts.delete(conflict.id);
    await this.refreshCounts('pending');
  }
}

export function installSyncTriggers(coordinator: SyncCoordinator): () => void {
  const sync = () => void coordinator.sync().catch(() => undefined);
  const visibility = () => {
    if (document.visibilityState === 'visible') sync();
  };
  window.addEventListener('online', sync);
  document.addEventListener('visibilitychange', visibility);
  sync();
  return () => {
    window.removeEventListener('online', sync);
    document.removeEventListener('visibilitychange', visibility);
  };
}
