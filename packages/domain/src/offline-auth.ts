export interface OfflineAuthorizationInput {
  lastAuthenticatedAt: Date | null;
  now?: Date;
}

export const OFFLINE_AUTHORIZATION_DAYS = 30;
const OFFLINE_AUTHORIZATION_MS = OFFLINE_AUTHORIZATION_DAYS * 24 * 60 * 60 * 1_000;

export type OfflineAuthorizationResult =
  | { allowed: true; expiresAt: string; reason: 'valid' }
  | {
      allowed: false;
      expiresAt: string | null;
      preserveLocalData: true;
      reason: 'expired' | 'missing';
    };

export function evaluateOfflineAuthorization(
  input: OfflineAuthorizationInput,
): OfflineAuthorizationResult {
  if (!input.lastAuthenticatedAt) {
    return {
      allowed: false,
      expiresAt: null,
      preserveLocalData: true,
      reason: 'missing',
    };
  }

  const now = input.now ?? new Date();
  const expiresAt = new Date(input.lastAuthenticatedAt.getTime() + OFFLINE_AUTHORIZATION_MS);
  if (now.getTime() <= expiresAt.getTime()) {
    return { allowed: true, expiresAt: expiresAt.toISOString(), reason: 'valid' };
  }

  return {
    allowed: false,
    expiresAt: expiresAt.toISOString(),
    preserveLocalData: true,
    reason: 'expired',
  };
}
