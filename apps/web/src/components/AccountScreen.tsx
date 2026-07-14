import { type FormEvent, useEffect, useState } from 'react';

import type { AppApi, SessionView } from '../auth-client';

export function AccountScreen({
  api,
  onAccountDeleted,
  onBack,
}: {
  api: AppApi;
  onAccountDeleted?(): Promise<void> | void;
  onBack(): void;
}) {
  const [sessions, setSessions] = useState<SessionView[]>([]);
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

  async function deleteAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api.deleteAccount({
        confirmation: String(data.get('confirmation') ?? ''),
        password: String(data.get('password') ?? ''),
      });
      await onAccountDeleted?.();
      setMessage('Conta excluída. Os dados locais serão removidos após a confirmação do servidor.');
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
