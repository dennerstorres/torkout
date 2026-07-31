import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';

import { createUserSyncDatabase, queueLocalMutation } from '../sync/local-database';
import { DEMO_USER_ID } from './demo-sync';
import { discardDemoReplica, hasDemoReplica, startDemo } from './demo-session';

const realUserId = 'aa000000-0000-4000-8000-000000000001';

afterEach(async () => {
  await discardDemoReplica();
});

describe('demonstration replica lifecycle', () => {
  it('creates a replica that survives a reload of the same session', async () => {
    await startDemo();
    expect(await hasDemoReplica()).toBe(true);

    const reopened = createUserSyncDatabase(DEMO_USER_ID);
    const seeded = await reopened.records.count();
    reopened.close();

    expect(seeded).toBeGreaterThan(0);
  });

  it('removes the replica when the visitor leaves the demonstration', async () => {
    await startDemo();

    await discardDemoReplica();

    expect(await hasDemoReplica()).toBe(false);
  });

  it('discards demonstration work instead of leaving it queued next to a real account', async () => {
    await startDemo();
    const database = createUserSyncDatabase(DEMO_USER_ID);
    await queueLocalMutation(database, {
      entityId: '11111111-1111-4111-8111-111111111111',
      entityType: 'body_measurement',
      operation: 'create',
      payload: { localDate: '2026-07-31', weightKg: 80 },
    });
    expect(await database.outbox.count()).toBe(1);
    database.close();

    await discardDemoReplica();

    const reopened = createUserSyncDatabase(DEMO_USER_ID);
    expect(await reopened.outbox.count()).toBe(0);
    reopened.close();
  });

  it('never touches the replica of a real account', async () => {
    const real = createUserSyncDatabase(realUserId);
    await queueLocalMutation(real, {
      entityId: '22222222-2222-4222-8222-222222222222',
      entityType: 'body_measurement',
      operation: 'create',
      payload: { localDate: '2026-07-31', weightKg: 81 },
    });
    real.close();

    await startDemo();
    await discardDemoReplica();

    const reopened = createUserSyncDatabase(realUserId);
    expect(await reopened.outbox.count()).toBe(1);
    reopened.close();
  });
});
