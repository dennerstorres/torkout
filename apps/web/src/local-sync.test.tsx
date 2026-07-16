import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createUserSyncDatabase,
  deleteUserSyncDatabase,
  pendingChangesForExport,
  pruneLocalTombstones,
  queueLocalMutation,
} from './sync/local-database';
import { SyncCoordinator, type SyncTransport } from './sync/sync-coordinator';

const users = {
  first: '60000000-0000-4000-8000-000000000001',
  second: '60000000-0000-4000-8000-000000000002',
};

const createdDatabases = new Set<string>();

async function databaseFor(userId: string) {
  createdDatabases.add(userId);
  return createUserSyncDatabase(userId);
}

afterEach(async () => {
  await Promise.all([...createdDatabases].map((userId) => deleteUserSyncDatabase(userId)));
  createdDatabases.clear();
});

describe('local-first replica', () => {
  it('marks pending export data without leaking device or retry metadata', async () => {
    const database = await databaseFor(users.first);
    await queueLocalMutation(database, {
      entityId: '70000000-0000-4000-8000-000000000010',
      entityType: 'body_measurement',
      operation: 'create',
      payload: {
        localDate: '2026-07-14',
        measuredAt: '2026-07-14T15:00:00.000Z',
        weightKg: 70,
      },
    });

    const pending = await pendingChangesForExport(database);
    expect(pending).toEqual([
      expect.objectContaining({
        entityId: '70000000-0000-4000-8000-000000000010',
        origin: 'local_pending',
      }),
    ]);
    expect(pending[0]).not.toHaveProperty('deviceId');
    expect(pending[0]).not.toHaveProperty('operationId');
    expect(pending[0]).not.toHaveProperty('attempts');
    expect(pending[0]).not.toHaveProperty('lastError');
    expect(pending[0]).not.toHaveProperty('state');
  });

  it('persists the record and outbox atomically across a reload', async () => {
    const database = await databaseFor(users.first);
    const operation = await queueLocalMutation(database, {
      entityId: '70000000-0000-4000-8000-000000000001',
      entityType: 'body_measurement',
      operation: 'create',
      payload: {
        localDate: '2026-07-14',
        measuredAt: '2026-07-14T15:00:00.000Z',
        weightKg: 70,
      },
    });
    database.close();

    const reopened = await databaseFor(users.first);
    expect(
      await reopened.records.get('body_measurement:70000000-0000-4000-8000-000000000001'),
    ).toMatchObject({ syncStatus: 'pending', version: 0 });
    expect(await reopened.outbox.get(operation.operationId)).toMatchObject({ state: 'pending' });
  });

  it('uses a physically separate IndexedDB database for each user', async () => {
    const first = await databaseFor(users.first);
    const second = await databaseFor(users.second);
    await queueLocalMutation(first, {
      entityId: '70000000-0000-4000-8000-000000000002',
      entityType: 'body_measurement',
      operation: 'create',
      payload: {
        localDate: '2026-07-14',
        measuredAt: '2026-07-14T15:00:00.000Z',
        waistCm: 80,
      },
    });

    expect(first.name).not.toBe(second.name);
    expect(await second.records.count()).toBe(0);
    expect(await second.outbox.count()).toBe(0);
  });

  it('coalesces repeated offline edits instead of creating self-conflicting operations', async () => {
    const database = await databaseFor(users.first);
    const entityId = '70000000-0000-4000-8000-000000000005';
    const created = await queueLocalMutation(database, {
      entityId,
      entityType: 'body_measurement',
      operation: 'create',
      payload: {
        localDate: '2026-07-14',
        measuredAt: '2026-07-14T15:00:00.000Z',
        weightKg: 70,
      },
    });
    const edited = await queueLocalMutation(database, {
      entityId,
      entityType: 'body_measurement',
      operation: 'update',
      payload: { weightKg: 71 },
    });

    expect(edited.operationId).toBe(created.operationId);
    expect(await database.outbox.count()).toBe(1);
    expect(await database.outbox.get(created.operationId)).toMatchObject({
      operation: 'create',
      payload: { weightKg: 71 },
    });
    expect(await database.records.get(`body_measurement:${entityId}`)).toMatchObject({
      data: { weightKg: 71 },
      version: 0,
    });
  });

  it('preserves pending work after an expired session and retries after reauthentication', async () => {
    const database = await databaseFor(users.first);
    await queueLocalMutation(database, {
      entityId: '70000000-0000-4000-8000-000000000003',
      entityType: 'body_measurement',
      operation: 'create',
      payload: {
        localDate: '2026-07-14',
        measuredAt: '2026-07-14T15:00:00.000Z',
        weightKg: 71,
      },
    });
    let authenticated = false;
    const transport: SyncTransport = {
      async pull() {
        return { changes: [], cursor: null, hasMore: false, serverTime: new Date().toISOString() };
      },
      async push(input) {
        expect(input.operations[0]).not.toHaveProperty('state');
        expect(input.operations[0]).not.toHaveProperty('attempts');
        if (!authenticated) {
          const error = new Error('auth required');
          Object.assign(error, { status: 401 });
          throw error;
        }
        return {
          results: input.operations.map((item) => ({
            operationId: item.operationId,
            record: { ...item.payload, id: item.entityId, version: 1 },
            status: 'applied' as const,
          })),
        };
      },
    };
    const coordinator = new SyncCoordinator(database, transport, { isOnline: () => true });

    await coordinator.sync();
    expect(coordinator.snapshot().state).toBe('auth-required');
    expect(await database.outbox.count()).toBe(1);

    authenticated = true;
    await coordinator.sync();
    expect(coordinator.snapshot()).toMatchObject({ pendingCount: 0, state: 'synced' });
    expect(await database.outbox.count()).toBe(0);
  });

  it('recovers idempotently when the network drops after the server commit', async () => {
    const database = await databaseFor(users.first);
    await queueLocalMutation(database, {
      entityId: '70000000-0000-4000-8000-000000000006',
      entityType: 'body_measurement',
      operation: 'create',
      payload: {
        localDate: '2026-07-14',
        measuredAt: '2026-07-14T15:00:00.000Z',
        weightKg: 72,
      },
    });
    const committed = new Set<string>();
    let pushes = 0;
    const transport: SyncTransport = {
      async pull() {
        return { changes: [], cursor: null, hasMore: false, serverTime: new Date().toISOString() };
      },
      async push(input) {
        pushes += 1;
        const item = input.operations[0]!;
        if (pushes === 1) {
          committed.add(item.operationId);
          throw new Error('connection dropped after commit');
        }
        return {
          results: [
            {
              operationId: item.operationId,
              record: { ...item.payload, id: item.entityId, version: 1 },
              status: committed.has(item.operationId)
                ? ('duplicate' as const)
                : ('applied' as const),
            },
          ],
        };
      },
    };
    const coordinator = new SyncCoordinator(database, transport, { isOnline: () => true });

    await coordinator.sync();
    expect(coordinator.snapshot().state).toBe('error');
    expect(await database.outbox.count()).toBe(1);
    await coordinator.sync();
    expect(coordinator.snapshot().state).toBe('synced');
    expect(await database.outbox.count()).toBe(0);
  });

  it('pushes more than 50 pending operations in API-sized batches', async () => {
    const database = await databaseFor(users.first);
    for (let index = 1; index <= 51; index += 1) {
      await queueLocalMutation(database, {
        entityId: `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        entityType: 'body_measurement',
        operation: 'create',
        payload: {
          localDate: '2026-07-14',
          measuredAt: '2026-07-14T15:00:00.000Z',
          weightKg: 70,
        },
      });
    }
    const batchSizes: number[] = [];
    const transport: SyncTransport = {
      async pull() {
        return { changes: [], cursor: null, hasMore: false, serverTime: new Date().toISOString() };
      },
      async push(input) {
        batchSizes.push(input.operations.length);
        return {
          results: input.operations.map((item) => ({
            operationId: item.operationId,
            record: { ...item.payload, id: item.entityId, version: 1 },
            status: 'applied' as const,
          })),
        };
      },
    };

    const coordinator = new SyncCoordinator(database, transport, { isOnline: () => true });
    await coordinator.sync();

    expect(batchSizes).toEqual([50, 1]);
    expect(coordinator.snapshot()).toMatchObject({ pendingCount: 0, state: 'synced' });
    expect(await database.outbox.count()).toBe(0);
  });

  it('does not resurrect a newer local tombstone when an older pull arrives', async () => {
    const database = await databaseFor(users.first);
    const key = 'body_measurement:70000000-0000-4000-8000-000000000004';
    await database.records.put({
      data: {},
      deletedAt: '2026-07-14T16:00:00.000Z',
      entityId: '70000000-0000-4000-8000-000000000004',
      entityType: 'body_measurement',
      key,
      syncStatus: 'synced',
      updatedAt: '2026-07-14T16:00:00.000Z',
      version: 3,
    });
    const transport: SyncTransport = {
      async push() {
        return { results: [] };
      },
      async pull() {
        return {
          changes: [
            {
              changedAt: '2026-07-14T15:00:00.000Z',
              deletedAt: null,
              entityId: '70000000-0000-4000-8000-000000000004',
              entityType: 'body_measurement' as const,
              operation: 'update' as const,
              payload: {
                id: '70000000-0000-4000-8000-000000000004',
                version: 2,
                weightKg: 69,
              },
              sequence: 1,
              version: 2,
            },
          ],
          cursor: 'cursor-1',
          hasMore: false,
          serverTime: '2026-07-14T15:00:00.000Z',
        };
      },
    };
    await new SyncCoordinator(database, transport, { isOnline: () => true }).sync();

    expect(await database.records.get(key)).toMatchObject({
      deletedAt: '2026-07-14T16:00:00.000Z',
      version: 3,
    });
  });

  it('prunes only synchronized tombstones older than the 90-day retention window', async () => {
    const database = await databaseFor(users.first);
    const records = [
      { id: '70000000-0000-4000-8000-000000000007', age: 91, status: 'synced' as const },
      { id: '70000000-0000-4000-8000-000000000008', age: 89, status: 'synced' as const },
      { id: '70000000-0000-4000-8000-000000000009', age: 100, status: 'pending' as const },
    ];
    const now = new Date('2026-07-14T15:00:00.000Z');
    await database.records.bulkPut(
      records.map((item) => ({
        data: {},
        deletedAt: new Date(now.getTime() - item.age * 86_400_000).toISOString(),
        entityId: item.id,
        entityType: 'body_measurement' as const,
        key: `body_measurement:${item.id}`,
        syncStatus: item.status,
        updatedAt: now.toISOString(),
        version: 2,
      })),
    );

    expect(await pruneLocalTombstones(database, now)).toBe(1);
    expect(await database.records.toCollection().primaryKeys()).toEqual([
      `body_measurement:${records[1]!.id}`,
      `body_measurement:${records[2]!.id}`,
    ]);
  });
});
