import {
  syncPullResponseSchema,
  syncPushResponseSchema,
  type SyncOperation,
} from '@torkout/contracts';

import type { SyncTransport } from './sync-coordinator';

async function syncRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api/v1/sync${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const error = new Error(`SYNC_HTTP_${response.status}`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response.json();
}

export const httpSyncTransport: SyncTransport = {
  async pull({ cursor }) {
    const query = new URLSearchParams({ limit: '50' });
    if (cursor) query.set('cursor', cursor);
    return syncPullResponseSchema.parse(await syncRequest(`/pull?${query}`));
  },
  async push(input: { operations: SyncOperation[] }) {
    return syncPushResponseSchema.parse(
      await syncRequest('/push', { body: JSON.stringify(input), method: 'POST' }),
    );
  },
};
