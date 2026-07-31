import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AppApi } from '../auth-client';
import { AuthScreen } from './AuthScreen';

function renderScreen(overrides: Partial<Parameters<typeof AuthScreen>[0]> = {}) {
  const signUp = vi.fn().mockResolvedValue(undefined);
  const api = { signUp } as unknown as AppApi;
  render(<AuthScreen api={api} version="teste" {...overrides} />);
  return { signUp };
}

describe('sign-up availability on the entry screen', () => {
  it('offers every route into registration when the instance enables sign-up', () => {
    renderScreen({ signUpEnabled: true });

    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Começar agora' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getAllByRole('button', { name: 'Criar conta' }).length).toBeGreaterThan(0);
  });

  it('removes every route into registration when sign-up is closed', () => {
    renderScreen({ signUpEnabled: false });

    expect(screen.queryByRole('button', { name: 'Criar conta' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Começar agora' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.queryByRole('button', { name: 'Criar conta' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cadastrar' })).toBeNull();
  });

  it('explains that registration is closed instead of failing silently', () => {
    renderScreen({ signUpEnabled: false });

    expect(screen.getByText(/cadastro está fechado/i)).toBeVisible();
  });

  it('keeps sign-in and password recovery available when sign-up is closed', () => {
    renderScreen({ signUpEnabled: false });

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('button', { name: 'Esqueci minha senha' })).toBeVisible();
    expect(screen.getByRole('dialog', { name: /entre no torkout/i })).toBeVisible();
  });

  it('keeps registration closed by default, without relying on the caller', () => {
    renderScreen();

    expect(screen.queryByRole('button', { name: 'Criar conta' })).toBeNull();
  });
});
