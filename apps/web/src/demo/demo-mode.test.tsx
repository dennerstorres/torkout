import 'fake-indexeddb/auto';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../App';
import type { AppApi } from '../auth-client';
import { AuthScreen } from '../components/AuthScreen';
import { discardDemoReplica, hasDemoReplica, startDemo } from './demo-session';

afterEach(async () => {
  await discardDemoReplica();
});

describe('entering the demonstration', () => {
  it('offers the demonstration where registration used to be, when sign-up is closed', () => {
    const onStartDemo = vi.fn();
    render(
      <AuthScreen
        api={{} as AppApi}
        onStartDemo={onStartDemo}
        signUpEnabled={false}
        version="teste"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver demonstração/i }));
    expect(onStartDemo).toHaveBeenCalledTimes(1);
  });

  it('does not offer the demonstration when the instance accepts registration', () => {
    render(<AuthScreen api={{} as AppApi} onStartDemo={vi.fn()} signUpEnabled version="teste" />);

    expect(screen.queryByRole('button', { name: /ver demonstração/i })).toBeNull();
  });
});

describe('running the demonstration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens Today with seeded content without any network request', async () => {
    render(<App demo />);

    expect(await screen.findByRole('heading', { name: /^Hoje$/ })).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    expect(await hasDemoReplica()).toBe(true);
  });

  it('keeps a permanent notice that nothing is being saved', async () => {
    render(<App demo />);

    const notice = await screen.findByRole('status', { name: /demonstração/i });
    expect(notice).toBeVisible();
    expect(notice).toHaveTextContent(/nada.*(salvo|guardado)/i);
  });

  it('discards a residual demonstration replica when a real account takes over', async () => {
    await startDemo();
    expect(await hasDemoReplica()).toBe(true);

    const api = {
      getProfile: vi
        .fn()
        .mockResolvedValue({ displayName: 'Pessoa Real', timeZone: 'America/Cuiaba' }),
      getSession: vi.fn().mockResolvedValue({
        user: { id: 'aa000000-0000-4000-8000-000000000009', name: 'Pessoa Real' },
      }),
      loadDaily: vi.fn().mockRejectedValue(new Error('offline')),
    } as unknown as AppApi;
    render(<App api={api} />);

    await waitFor(async () => expect(await hasDemoReplica()).toBe(false));
  });

  it('starts the demonstration from its own address, so it can be linked', async () => {
    window.history.pushState({}, '', '/demo');

    render(<App />);

    expect(await screen.findByRole('status', { name: /demonstração/i })).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('leaves the demonstration address behind when the visitor exits', async () => {
    window.history.pushState({}, '', '/demo');
    render(<App />);
    await screen.findByRole('status', { name: /demonstração/i });

    fireEvent.click(screen.getByRole('button', { name: /sair da demonstração/i }));

    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('removes the replica when the visitor leaves the demonstration', async () => {
    render(<App demo />);
    await screen.findByRole('heading', { name: /^Hoje$/ });

    fireEvent.click(screen.getByRole('button', { name: /sair da demonstração/i }));

    await waitFor(async () => expect(await hasDemoReplica()).toBe(false));
  });
});
