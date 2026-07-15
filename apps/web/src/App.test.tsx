import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';

function createApi(overrides: Record<string, unknown> = {}) {
  return {
    acceptPrivacy: vi.fn(async () => undefined),
    deleteAccount: vi.fn(async () => ({
      activeDataDeleted: true as const,
      backupRetention: {
        appliesTo: 'Backups isolados.',
        maximumDays: 365,
        policy: '7 diárias, 5 semanais e 12 mensais.',
      },
    })),
    exportData: vi.fn(async () => ({
      blob: new Blob(['{}'], { type: 'application/json' }),
      fileName: 'torkout-export.json',
    })),
    getProfile: vi.fn(async () => {
      throw new Error('PROFILE_NOT_FOUND');
    }),
    getSession: vi.fn(async () => null),
    listPrivacyDocuments: vi.fn(async () => ({ documents: [] })),
    listProgressionSuggestions: vi.fn(async () => ({ items: [] })),
    listSessions: vi.fn(async () => []),
    loadDaily: vi.fn(async () => ({
      habits: [],
      habitEntries: [],
      measurements: [],
      painReports: [],
      sessions: [],
    })),
    loadHistoryPage: vi.fn(async () => ({ days: [], habits: [], nextCursor: null })),
    loadProgressAnalytics: vi.fn(async () => ({
      consistency: {
        explanation: 'FÃ³rmula de consistÃªncia.',
        formulaVersion: 'weekly-consistency/v1' as const,
        weeks: [],
      },
      exercises: [],
      measurements: [],
      pain: [],
      range: { from: '2026-07-01', through: '2026-07-14' },
      sessions: { completed: 0, partial: 0 },
      walks: { distanceMeters: 0, frequencyPerWeek: 0, sessions: 0 },
    })),
    importDailyHistory: vi.fn(async () => ({ created: true, sessionId: 'history-session' })),
    requestPasswordReset: vi.fn(async () => undefined),
    decideProgression: vi.fn(async () => ({
      decision: 'accepted',
      effectEntityId: null,
      id: 'decision',
    })),
    resetPassword: vi.fn(async () => undefined),
    revokeSession: vi.fn(async () => undefined),
    saveProfile: vi.fn(async () => undefined),
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    signUp: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('public authentication journey', () => {
  it('offers accessible login, registration and recovery forms', async () => {
    const api = createApi();
    render(<App api={api} />);

    expect(await screen.findByRole('heading', { name: 'Entre no Torkout' })).toBeVisible();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Pessoa Nova' } });
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'new@example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'strong-password-123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Cadastrar' }).closest('form')!);

    await waitFor(() =>
      expect(api.signUp).toHaveBeenCalledWith({
        email: 'new@example.invalid',
        name: 'Pessoa Nova',
        password: 'strong-password-123',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se os dados puderem ser usados, enviaremos uma confirmação por e-mail.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }));
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'new@example.invalid' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar link' }).closest('form')!);
    await waitFor(() => expect(api.requestPasswordReset).toHaveBeenCalled());
  });

  it('sets a new password from the one-time recovery token', async () => {
    window.history.pushState({}, '', '/reset-password?token=reset-token');
    const api = createApi();
    render(<App api={api} />);

    expect(await screen.findByRole('heading', { name: 'Defina uma nova senha' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'new-strong-password-456' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar nova senha' }).closest('form')!);
    await waitFor(() =>
      expect(api.resetPassword).toHaveBeenCalledWith('reset-token', 'new-strong-password-456'),
    );
    window.history.pushState({}, '', '/');
  });
});

describe('authenticated account journey', () => {
  it('moves focus to the destination heading after in-app navigation', async () => {
    const api = createApi({
      getProfile: vi.fn(async () => ({ displayName: 'Pessoa A' })),
      getSession: vi.fn(async () => ({
        user: { id: '62000000-0000-4000-8000-000000000003', name: 'Pessoa A' },
      })),
    });
    render(<App api={api} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Minha conta' }));
    expect(await screen.findByRole('heading', { name: 'Sessões e conta' })).toHaveFocus();
  });

  it('offers progress analytics from the authenticated home', async () => {
    const api = createApi({
      getProfile: vi.fn(async () => ({ displayName: 'Pessoa A' })),
      getSession: vi.fn(async () => ({
        user: { id: '62000000-0000-4000-8000-000000000001', name: 'Pessoa A' },
      })),
    });
    render(<App api={api} />);

    expect(await screen.findByRole('button', { name: 'Progresso e indicadores' })).toBeVisible();
  });

  it('collects onboarding, explicit health consent and optional initial measurements', async () => {
    const api = createApi({
      getSession: vi.fn(async () => ({ user: { id: 'user-a', name: 'Pessoa A' } })),
      listPrivacyDocuments: vi.fn(async () => ({
        documents: [
          {
            content: 'Privacidade',
            title: 'Aviso de privacidade',
            type: 'privacy_notice',
            version: '2026-07-14',
          },
          { content: 'Termos', title: 'Termos de uso', type: 'terms', version: '2026-07-14' },
          {
            content: 'Saúde',
            title: 'Dados de saúde',
            type: 'health_data_consent',
            version: '2026-07-14',
          },
        ],
      })),
    });
    render(<App api={api} />);

    expect(await screen.findByRole('heading', { name: 'Configure seu perfil' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Nome de exibição'), {
      target: { value: 'Pessoa A' },
    });
    fireEvent.change(screen.getByLabelText('Altura (cm)'), { target: { value: '171' } });
    fireEvent.change(screen.getByLabelText('Peso inicial (kg), opcional'), {
      target: { value: '70' },
    });
    fireEvent.click(screen.getByLabelText('Café'));
    fireEvent.click(screen.getByLabelText(/Li e aceito os documentos/));
    fireEvent.click(screen.getByLabelText(/Entendo que as sugestões não substituem/));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Concluir configuração' }).closest('form')!,
    );

    await waitFor(() => expect(api.saveProfile).toHaveBeenCalled());
    expect(api.acceptPrivacy).toHaveBeenCalledWith({
      documentVersions: {
        health_data_consent: '2026-07-14',
        privacy_notice: '2026-07-14',
        terms: '2026-07-14',
      },
    });
  });

  it('allows the cached identity inside the offline window and locks after expiry without clearing outbox', async () => {
    localStorage.setItem(
      'torkout:offline-identity',
      JSON.stringify({
        lastAuthenticatedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1_000).toISOString(),
        name: 'Pessoa Offline',
        userId: 'user-offline',
      }),
    );
    const api = createApi({
      getSession: vi.fn(async () => {
        throw new Error('NETWORK');
      }),
    });
    const first = render(<App api={api} />);
    expect(await screen.findByText(/Pessoa Offline/)).toBeVisible();
    expect(screen.getByText(/modo offline/i)).toBeVisible();
    first.unmount();

    localStorage.setItem(
      'torkout:offline-identity',
      JSON.stringify({
        lastAuthenticatedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1_000).toISOString(),
        name: 'Pessoa Offline',
        userId: 'user-offline',
      }),
    );
    localStorage.setItem('torkout:outbox:user-offline', JSON.stringify([{ id: 'pending' }]));
    render(<App api={api} />);
    expect(await screen.findByRole('heading', { name: 'Reconecte para continuar' })).toBeVisible();
    expect(localStorage.getItem('torkout:outbox:user-offline')).toContain('pending');
  });

  it('lists and revokes sessions and requires the deletion phrase and password', async () => {
    const api = createApi({
      getProfile: vi.fn(async () => ({ displayName: 'Pessoa A' })),
      getSession: vi.fn(async () => ({
        user: { id: '62000000-0000-4000-8000-000000000002', name: 'Pessoa A' },
      })),
      listSessions: vi.fn(async () => [
        { createdAt: '2026-07-14T10:00:00Z', token: 'session-token', userAgent: 'Browser' },
      ]),
    });
    render(<App api={api} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Minha conta' }));
    expect(await screen.findByRole('heading', { name: 'Sessões e conta' })).toBeVisible();
    fireEvent.click(await screen.findByRole('button', { name: 'Revogar sessão' }));
    await waitFor(() => expect(api.revokeSession).toHaveBeenCalledWith('session-token'));

    fireEvent.change(screen.getByLabelText('Digite EXCLUIR MINHA CONTA'), {
      target: { value: 'EXCLUIR MINHA CONTA' },
    });
    fireEvent.change(screen.getByLabelText('Confirme sua senha'), {
      target: { value: 'correct-password' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Excluir minha conta' }).closest('form')!);
    await waitFor(() =>
      expect(api.deleteAccount).toHaveBeenCalledWith({
        confirmation: 'EXCLUIR MINHA CONTA',
        password: 'correct-password',
      }),
    );
  });
});
