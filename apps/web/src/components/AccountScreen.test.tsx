import 'fake-indexeddb/auto';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DataExportRequest } from '@torkout/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppApi } from '../auth-client';
import {
  createUserSyncDatabase,
  deleteUserSyncDatabase,
  queueLocalMutation,
} from '../sync/local-database';
import { AccountScreen } from './AccountScreen';

const userId = '61000000-0000-4000-8000-000000000001';

afterEach(async () => {
  await deleteUserSyncDatabase(userId);
});

describe('account portability screen', () => {
  it('exports JSON with a sanitized marked outbox and explains backup retention', async () => {
    const database = createUserSyncDatabase(userId);
    await queueLocalMutation(database, {
      entityId: '71000000-0000-4000-8000-000000000001',
      entityType: 'body_measurement',
      operation: 'create',
      payload: {
        localDate: '2026-07-14',
        measuredAt: '2026-07-14T15:00:00.000Z',
        weightKg: 70,
      },
    });
    const exportData = vi.fn(async (input: DataExportRequest) => {
      void input;
      return {
        blob: new Blob(['{}'], { type: 'application/json' }),
        fileName: 'torkout-export.json',
      };
    });
    const onDownload = vi.fn();
    const api = {
      exportData,
      listSessions: vi.fn(async () => []),
    } as unknown as AppApi;

    render(
      <AccountScreen
        api={api}
        database={database}
        onBack={() => undefined}
        onDownload={onDownload}
        version="1.0.0"
      />,
    );

    expect(screen.getByText(/7 diárias, 5 semanais e 12 mensais/i)).toBeVisible();
    expect(screen.getByRole('region', { name: 'Aplicativo' })).toBeVisible();
    expect(screen.getByText(/Versão 1\.0\.0/)).toBeVisible();
    expect(screen.getByLabelText(/Incluir alterações locais pendentes/i)).toBeChecked();
    expect(screen.getByRole('group', { name: 'Opções de exportação' })).toHaveClass(
      'account-export-actions',
    );
    expect(screen.getByRole('button', { name: 'Exportar relatório Markdown' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar JSON' }));

    await waitFor(() => expect(exportData).toHaveBeenCalledOnce());
    const input = exportData.mock.calls[0]![0];
    expect(input).toMatchObject({
      format: 'json',
      pendingChanges: [
        expect.objectContaining({
          entityId: '71000000-0000-4000-8000-000000000001',
          origin: 'local_pending',
        }),
      ],
    });
    expect(JSON.stringify(input)).not.toMatch(/deviceId|operationId|attempts|lastError|state/);
    expect(onDownload).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'torkout-export.json' }),
    );
  });

  it('requires an explicit second step before destructive local removal and reports server errors', async () => {
    const onSignOut = vi.fn();
    const api = {
      deleteAccount: vi.fn().mockRejectedValue(new Error('reauthentication_required')),
      listSessions: vi.fn(async () => []),
    } as unknown as AppApi;

    render(
      <AccountScreen api={api} onBack={() => undefined} onSignOut={onSignOut} version="1.0.0" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sair e remover dados deste dispositivo' }));
    expect(onSignOut).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/alterações.*não foram sincronizadas/i);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Digite EXCLUIR MINHA CONTA'), {
      target: { value: 'EXCLUIR MINHA CONTA' },
    });
    fireEvent.change(screen.getByLabelText('Confirme sua senha'), {
      target: { value: 'senha-incorreta' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Excluir minha conta' }).closest('form')!);
    expect(
      await screen.findByText(/Não foi possível excluir a conta.*frase de confirmação/i),
    ).toBeVisible();
  });
});
