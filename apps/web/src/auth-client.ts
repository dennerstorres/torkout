import { createAuthClient } from 'better-auth/client';

export interface SessionView {
  createdAt: string | Date;
  token: string;
  userAgent?: string | null;
}

export interface PrivacyDocumentView {
  content: string;
  title: string;
  type: 'health_data_consent' | 'privacy_notice' | 'terms';
  version: string;
}

export interface AppApi {
  acceptPrivacy(input: { documentVersions: Record<string, string> }): Promise<void>;
  deleteAccount(input: { confirmation: string; password: string }): Promise<void>;
  getProfile(): Promise<{ displayName: string }>;
  getSession(): Promise<{ user: { id: string; name: string } } | null>;
  listPrivacyDocuments(): Promise<{ documents: PrivacyDocumentView[] }>;
  listSessions(): Promise<SessionView[]>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  revokeSession(token: string): Promise<void>;
  saveProfile(input: Record<string, unknown>): Promise<void>;
  signIn(input: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  signUp(input: { email: string; name: string; password: string }): Promise<void>;
}

export const authClient = createAuthClient({ basePath: '/auth' });

async function productRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { code?: string } | null;
    throw new Error(error?.code ?? `HTTP_${response.status}`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

function assertAuthResult(result: unknown): void {
  const error = (result as { error?: { message?: string } | null }).error;
  if (error) throw new Error(error.message ?? 'AUTH_ERROR');
}

export const browserApi: AppApi = {
  acceptPrivacy: (input) =>
    productRequest('/privacy/acceptances', { body: JSON.stringify(input), method: 'POST' }),
  deleteAccount: (input) =>
    productRequest('/account', { body: JSON.stringify(input), method: 'DELETE' }),
  getProfile: () => productRequest('/profile'),
  async getSession() {
    const result = await authClient.getSession();
    assertAuthResult(result);
    return result.data as { user: { id: string; name: string } } | null;
  },
  listPrivacyDocuments: () => productRequest('/privacy/documents'),
  async listSessions() {
    const result = await authClient.listSessions();
    assertAuthResult(result);
    return (result.data ?? []) as SessionView[];
  },
  async requestPasswordReset(email) {
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    assertAuthResult(result);
  },
  async resetPassword(token, newPassword) {
    const result = await authClient.resetPassword({ newPassword, token });
    assertAuthResult(result);
  },
  async revokeSession(token) {
    const result = await authClient.revokeSession({ token });
    assertAuthResult(result);
  },
  saveProfile: (input) =>
    productRequest('/profile', { body: JSON.stringify(input), method: 'PUT' }),
  async signIn(input) {
    const result = await authClient.signIn.email(input);
    assertAuthResult(result);
  },
  async signOut() {
    const result = await authClient.signOut();
    assertAuthResult(result);
  },
  async signUp(input) {
    const result = await authClient.signUp.email(input);
    assertAuthResult(result);
  },
};
