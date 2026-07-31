import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createUserSyncDatabase,
  deleteUserSyncDatabase,
  queueLocalMutation,
} from '../sync/local-database';
import { SyncCoordinator } from '../sync/sync-coordinator';
import { DEMO_USER_ID, demoSyncTransport } from './demo-sync';

describe('demonstration never reaches the server', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await deleteUserSyncDatabase(DEMO_USER_ID);
  });

  it('refuses to pull and to push instead of quietly doing nothing', async () => {
    await expect(demoSyncTransport.pull({ cursor: null })).rejects.toThrow(/DEMO/);
    await expect(demoSyncTransport.push({ operations: [] })).rejects.toThrow(/DEMO/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps queued demonstration work unsent even when a sync is forced', async () => {
    const database = createUserSyncDatabase(DEMO_USER_ID);
    const coordinator = new SyncCoordinator(database, demoSyncTransport, { isOnline: () => true });

    await queueLocalMutation(database, {
      entityId: '11111111-1111-4111-8111-111111111111',
      entityType: 'body_measurement',
      operation: 'create',
      payload: { localDate: '2026-07-31', weightKg: 80 },
    });

    await coordinator.sync();
    await coordinator.retryFailed();
    await coordinator.sync();

    expect(fetch).not.toHaveBeenCalled();
    const remaining = await database.outbox.toArray();
    expect(remaining.every((entry) => entry.state !== 'sending')).toBe(true);
    database.close();
  });

  it('reserves a demonstration identifier that no real account can collide with', () => {
    expect(DEMO_USER_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  });
});
