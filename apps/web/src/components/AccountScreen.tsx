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
  onSignOut,
}: {
  api: AppApi;
  database?: UserSyncDatabase;
  onAccountDeleted?(): Promise<void> | void;
  onBack(): void;
  onDownload?(download: PortableDownload): void;
  onSignOut?(removeLocalData: boolean): Promise<void> | void;
}) {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [includePending, setIncludePending] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmLocalRemoval, setConfirmLocalRemoval] = useState(false);

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
        <p className="eyebrow">Preferências e privacidade</p>
        <h1>Conta</h1>
        <section className="account-section" aria-labelledby="account-profile-title">
          <h2 id="account-profile-title">Perfil</h2>
          <p>Suas informações pessoais e preferências de treino ficam vinculadas à sua conta.</p>
        </section>
        <section className="account-section" aria-labelledby="account-data-title">
          <h2 id="account-data-title">Sincronização e dados</h2>
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
        </section>
        <section className="account-section" aria-labelledby="account-sessions-title">
          <h2 id="account-sessions-title">Sessões e acesso</h2>
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
          {onSignOut && (
            <div className="sign-out-options">
              <button type="button" onClick={() => void onSignOut(false)}>
                Sair e manter dados neste dispositivo
              </button>
              {!confirmLocalRemoval ? (
                <button type="button" onClick={() => setConfirmLocalRemoval(true)}>
                  Sair e remover dados deste dispositivo
                </button>
              ) : (
                <div className="local-removal-confirmation" role="alert">
                  <p>
                    As alterações que ainda não foram sincronizadas serão removidas deste
                    dispositivo.
                  </p>
                  <div className="button-row">
                    <button className="danger" type="button" onClick={() => void onSignOut(true)}>
                      Confirmar saída e remoção
                    </button>
                    <button type="button" onClick={() => setConfirmLocalRemoval(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
        <section className="account-section danger-zone" aria-labelledby="account-danger-title">
          <h2 id="account-danger-title">Zona de risco</h2>
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
        </section>
        {message && <p role="status">{message}</p>}
      </section>
    </main>
  );
}
