import { type FormEvent, useEffect, useState } from 'react';

import type { AppApi, PortableDownload, SessionView } from '../auth-client';
import { pendingChangesForExport, type UserSyncDatabase } from '../sync/local-database';

function downloadInBrowser(download: PortableDownload): void {
  const url = URL.createObjectURL(download.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = download.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AccountScreen({
  api,
  database,
  onAccountDeleted,
  onBack,
  onDownload = downloadInBrowser,
}: {
  api: AppApi;
  database?: UserSyncDatabase;
  onAccountDeleted?(): Promise<void> | void;
  onBack(): void;
  onDownload?(download: PortableDownload): void;
}) {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [includePending, setIncludePending] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void api
      .listSessions()
      .then(setSessions)
      .catch(() => setMessage('Não foi possível listar as sessões.'));
  }, [api]);

  async function remove(token: string): Promise<void> {
    await api.revokeSession(token);
    setSessions((current) => current.filter((session) => session.token !== token));
  }

  async function exportData(format: 'csv_zip' | 'json'): Promise<void> {
    setExporting(true);
    setMessage('');
    try {
      const pendingChanges =
        includePending && database ? await pendingChangesForExport(database) : [];
      const download = await api.exportData({ format, pendingChanges });
      onDownload(download);
      setMessage(
        pendingChanges.length > 0
          ? `Exportação pronta com ${pendingChanges.length} alteração local pendente identificada.`
          : 'Exportação pronta.',
      );
    } catch {
      setMessage('Não foi possível exportar seus dados.');
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api.deleteAccount({
        confirmation: String(data.get('confirmation') ?? ''),
        password: String(data.get('password') ?? ''),
      });
      await onAccountDeleted?.();
      setMessage('Conta excluída e dados locais removidos após a confirmação do servidor.');
    } catch {
      setMessage('Não foi possível excluir a conta. Confira a senha e a frase de confirmação.');
    }
  }

  return (
    <main className="centered-layout">
      <section className="card wide-card">
        <button className="back-button" type="button" onClick={onBack}>
          ← Voltar
        </button>
        <h1>Sessões e conta</h1>
        <h2>Exportar meus dados</h2>
        <p>
          O JSON é versionado. O ZIP contém CSVs UTF-8 normalizados e um guia de datas, unidades e
          relacionamentos. Credenciais, sessões e metadados internos não são incluídos.
        </p>
        <label className="checkbox-row">
          <input
            checked={includePending}
            disabled={!database}
            type="checkbox"
            onChange={(event) => setIncludePending(event.target.checked)}
          />
          Incluir alterações locais pendentes, identificadas separadamente
        </label>
        <div className="button-row">
          <button disabled={exporting} type="button" onClick={() => void exportData('json')}>
            Exportar JSON
          </button>
          <button disabled={exporting} type="button" onClick={() => void exportData('csv_zip')}>
            Exportar CSV (ZIP)
          </button>
        </div>
        <hr />
        <h2>Dispositivos conectados</h2>
        {sessions.length === 0 ? (
          <p>Nenhuma outra sessão ativa.</p>
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <li key={session.token}>
                <span>{session.userAgent || 'Dispositivo não identificado'}</span>
                <button type="button" onClick={() => void remove(session.token)}>
                  Revogar sessão
                </button>
              </li>
            ))}
          </ul>
        )}
        <hr />
        <h2>Excluir conta</h2>
        <p>Esta ação exige nova confirmação da sua senha e não pode ser desfeita.</p>
        <p>
          Os dados ativos e o acesso são removidos imediatamente após a confirmação do servidor.
          Cópias isoladas de backup seguem a retenção de 7 diárias, 5 semanais e 12 mensais (no
          máximo 365 dias) e não voltam ao produto ativo.
        </p>
        <form onSubmit={(event) => void deleteAccount(event)}>
          <label>
            Digite EXCLUIR MINHA CONTA
            <input name="confirmation" required />
          </label>
          <label>
            Confirme sua senha
            <input autoComplete="current-password" name="password" required type="password" />
          </label>
          <button className="danger" type="submit">
            Excluir minha conta
          </button>
        </form>
        {message && <p role="status">{message}</p>}
      </section>
    </main>
  );
}
