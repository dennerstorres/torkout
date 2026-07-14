import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SyncPanel } from './SyncPanel';

describe('SyncPanel', () => {
  it('shows pending and conflict details with explicit actions', () => {
    const onExport = vi.fn();
    const onResolve = vi.fn();
    const onRetry = vi.fn();
    const onSync = vi.fn();
    render(
      <SyncPanel
        conflicts={[
          {
            entityId: 'measurement-1',
            entityType: 'body_measurement',
            id: 'conflict-1',
            localPayload: { weightKg: 71 },
            serverRecord: { version: 2, weightKg: 70 },
          },
        ]}
        onExport={onExport}
        onResolve={onResolve}
        onRetry={onRetry}
        onSync={onSync}
        pendingCount={2}
        pendingOperations={[
          {
            attempts: 1,
            baseVersion: 1,
            clientOccurredAt: '2026-07-14T15:00:00.000Z',
            deviceId: '30000000-0000-4000-8000-000000000001',
            entityId: '40000000-0000-4000-8000-000000000001',
            entityType: 'body_measurement',
            lastError: 'network_error',
            operation: 'update',
            operationId: '50000000-0000-4000-8000-000000000001',
            payload: { weightKg: 71 },
            state: 'pending',
          },
        ]}
        state="conflict"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('2 alterações pendentes');
    expect(screen.getByText(/Versão local/)).toBeInTheDocument();
    expect(screen.getByText(/Versão do servidor/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Inspecionar pendências'));
    expect(screen.getByText(/body_measurement.*update/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar agora' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar pendências' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar pendências novamente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Usar versão local' }));
    expect(onSync).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onResolve).toHaveBeenCalledWith('conflict-1', 'local');
  });
});
