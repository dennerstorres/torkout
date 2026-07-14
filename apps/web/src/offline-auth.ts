import { evaluateOfflineAuthorization } from '@torkout/domain';

const STORAGE_KEY = 'torkout:offline-identity';

export interface OfflineIdentity {
  lastAuthenticatedAt: string;
  name: string;
  userId: string;
}

export function recordOnlineIdentity(
  identity: { name: string; userId: string },
  now = new Date(),
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...identity,
      lastAuthenticatedAt: now.toISOString(),
    } satisfies OfflineIdentity),
  );
}

export function readOfflineIdentity(now = new Date()): {
  allowed: boolean;
  identity: OfflineIdentity | null;
  reason: 'expired' | 'missing' | 'valid';
} {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { allowed: false, identity: null, reason: 'missing' };
  try {
    const identity = JSON.parse(raw) as OfflineIdentity;
    if (!identity.userId || !identity.name || !identity.lastAuthenticatedAt) throw new Error();
    const result = evaluateOfflineAuthorization({
      lastAuthenticatedAt: new Date(identity.lastAuthenticatedAt),
      now,
    });
    return { allowed: result.allowed, identity, reason: result.reason };
  } catch {
    return { allowed: false, identity: null, reason: 'missing' };
  }
}

export function clearOfflineIdentity(): void {
  localStorage.removeItem(STORAGE_KEY);
}
