import { createAuthClient } from 'better-auth/client';
import type {
  AccountDeletionResponse,
  DataExportRequest,
  HistoryPage,
  ProgressAnalyticsResponse,
} from '@torkout/contracts';

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

export interface DailyBootstrap {
  habits: Array<Record<string, unknown>>;
  habitEntries: Array<Record<string, unknown>>;
  measurements: Array<Record<string, unknown>>;
  painReports: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
}

export interface ProgressionSuggestionView {
  createdAt: string;
  evidence: unknown;
  explanation: string;
  exerciseName: string;
  id: string;
  outcome: 'eligible' | 'blocked' | 'no_change';
  proposal: Record<string, unknown>;
  rule: { code: string; version: string };
  safetyNotice: string;
  safetyNoticeVersion: string;
  status: 'pending' | 'accepted' | 'ignored' | 'snoozed' | 'invalidated' | 'expired';
  type: 'increase' | 'maintain' | 'reduce' | 'stop';
  validUntil: string | null;
  version: number;
}

export interface PortableDownload {
  blob: Blob;
  fileName: string;
}

export interface AppApi {
  acceptPrivacy(input: { documentVersions: Record<string, string> }): Promise<void>;
  deleteAccount(input: {
    confirmation: string;
    password: string;
  }): Promise<AccountDeletionResponse>;
  exportData(input: DataExportRequest): Promise<PortableDownload>;
  getProfile(): Promise<{ displayName: string; timeZone?: string }>;
  getSession(): Promise<{ user: { id: string; name: string } } | null>;
  listPrivacyDocuments(): Promise<{ documents: PrivacyDocumentView[] }>;
  listProgressionSuggestions(status?: ProgressionSuggestionView['status']): Promise<{
    items: ProgressionSuggestionView[];
  }>;
  listSessions(): Promise<SessionView[]>;
  loadDaily(localDate: string): Promise<DailyBootstrap>;
  loadHistoryPage(from: string, through: string, cursor?: string): Promise<HistoryPage>;
  loadProgressAnalytics(from: string, through: string): Promise<ProgressAnalyticsResponse>;
  requestPasswordReset(email: string): Promise<void>;
  decideProgression(
    suggestionId: string,
    decision: 'accepted' | 'ignored' | 'snoozed',
  ): Promise<{ decision: string; effectEntityId: string | null; id: string }>;
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

async function exportRequest(input: DataExportRequest): Promise<PortableDownload> {
  const response = await fetch('/api/v1/exports', {
    body: JSON.stringify(input),
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { code?: string } | null;
    throw new Error(error?.code ?? `HTTP_${response.status}`);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const fileName = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  return {
    blob: await response.blob(),
    fileName:
      fileName ??
      (input.format === 'markdown'
        ? 'RELATORIO_EVOLUCAO.md'
        : `torkout-export.${input.format === 'json' ? 'json' : 'zip'}`),
  };
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
  exportData: exportRequest,
  getProfile: () => productRequest('/profile'),
  async getSession() {
    const result = await authClient.getSession();
    assertAuthResult(result);
    return result.data as { user: { id: string; name: string } } | null;
  },
  listPrivacyDocuments: () => productRequest('/privacy/documents'),
  listProgressionSuggestions: (status) =>
    productRequest(
      `/progression/suggestions${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    ),
  async loadDaily(localDate) {
    const query = encodeURIComponent(localDate);
    const [sessions, habits, habitEntries, painReports, measurements] = await Promise.all([
      productRequest<{ items: Array<Record<string, unknown>> }>(
        `/sessions?from=${query}&through=${query}`,
      ),
      productRequest<{ items: Array<Record<string, unknown>> }>('/habits'),
      productRequest<{ items: Array<Record<string, unknown>> }>(
        `/habits/entries?localDate=${query}`,
      ),
      productRequest<{ items: Array<Record<string, unknown>> }>(`/pain-reports?localDate=${query}`),
      productRequest<{ items: Array<Record<string, unknown>> }>(`/measurements?localDate=${query}`),
    ]);
    return {
      habits: habits.items,
      habitEntries: habitEntries.items,
      measurements: measurements.items,
      painReports: painReports.items,
      sessions: sessions.items,
    };
  },
  loadHistoryPage: (from, through, cursor) => {
    const query = new URLSearchParams({ from, limit: '14', through });
    if (cursor) query.set('cursor', cursor);
    return productRequest(`/history?${query.toString()}`);
  },
  loadProgressAnalytics: (from, through) => {
    const query = new URLSearchParams({ from, through });
    return productRequest(`/progress?${query.toString()}`);
  },
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
  decideProgression: (suggestionId, decision) =>
    productRequest(`/progression/suggestions/${encodeURIComponent(suggestionId)}/decisions`, {
      body: JSON.stringify({ decision }),
      method: 'POST',
    }),
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
