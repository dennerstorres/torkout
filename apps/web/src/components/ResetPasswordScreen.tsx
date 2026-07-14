import { type FormEvent, useState } from 'react';

import type { AppApi } from '../auth-client';

export function ResetPasswordScreen({ api, token }: { api: AppApi; token: string }) {
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api.resetPassword(token, String(data.get('newPassword') ?? ''));
      setMessage('Senha alterada. Você já pode voltar e entrar.');
    } catch {
      setMessage('O link expirou ou já foi utilizado. Solicite uma nova recuperação.');
    }
  }

  return (
    <main className="centered-layout">
      <section className="card auth-card">
        <p className="eyebrow">Recuperação de conta</p>
        <h1>Defina uma nova senha</h1>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Nova senha
            <input
              autoComplete="new-password"
              minLength={12}
              name="newPassword"
              required
              type="password"
            />
          </label>
          <button className="primary" type="submit">
            Salvar nova senha
          </button>
        </form>
        {message && <p role="status">{message}</p>}
      </section>
    </main>
  );
}
