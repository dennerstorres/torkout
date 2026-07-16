import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticatedShell } from './AuthenticatedShell';

describe('authenticated application shell', () => {
  it.each(['offline', 'error', 'conflict', 'pending'] as const)(
    'keeps the %s sync state visible and operable',
    (state) => {
      const onNavigate = vi.fn();
      render(
        <AuthenticatedShell
          conflicts={[]}
          name="Ana"
          onExport={vi.fn()}
          onNavigate={onNavigate}
          onResolve={vi.fn()}
          onRetry={vi.fn()}
          onSync={vi.fn()}
          pendingCount={state === 'pending' ? 2 : 0}
          state={state}
          version="1.2.3"
          view="today"
        >
          <main>
            <h1>Hoje</h1>
          </main>
        </AuthenticatedShell>,
      );
      expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
      expect(screen.getByText('Versão 1.2.3')).toBeInTheDocument();
      expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('button', { name: 'Planejamento' }));
      expect(onNavigate).toHaveBeenCalledWith('planning');
      fireEvent.click(screen.getByLabelText('Abrir detalhes da sincronização'));
      expect(screen.getByRole('heading', { name: 'Sincronização' })).toBeVisible();
    },
  );
});
