import { type FormEvent, useState } from 'react';

import type { AppApi } from '../auth-client';

type Mode = 'login' | 'recovery' | 'register';

export function AuthScreen({ api }: { api: AppApi }) {
  const [mode, setMode] = useState<Mode>('login');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '');
    try {
      if (mode === 'register') {
        await api.signUp({
          email,
          name: String(data.get('name') ?? ''),
          password: String(data.get('password') ?? ''),
        });
        setMessage('Se os dados puderem ser usados, enviaremos uma confirmação por e-mail.');
      } else if (mode === 'recovery') {
        await api.requestPasswordReset(email);
        setMessage('Se a conta existir, enviaremos um link de recuperação por e-mail.');
      } else {
        await api.signIn({ email, password: String(data.get('password') ?? '') });
        window.location.reload();
      }
    } catch {
      setMessage(
        'Não foi possível concluir. Confira os dados ou aguarde antes de tentar novamente.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="intro-panel" aria-labelledby="brand-title">
        <p className="eyebrow">Acompanhamento pessoal</p>
        <p className="brand" id="brand-title">
          Torkout
        </p>
        <p>Organize seu treino e acompanhe sua evolução com privacidade, inclusive offline.</p>
      </section>
      <section className="card auth-card">
        <h1>
          {mode === 'login'
            ? 'Entre no Torkout'
            : mode === 'register'
              ? 'Crie sua conta'
              : 'Recupere sua senha'}
        </h1>
        <form onSubmit={(event) => void submit(event)}>
          {mode === 'register' && (
            <label>
              Nome
              <input autoComplete="name" name="name" required />
            </label>
          )}
          <label>
            E-mail
            <input autoComplete="email" name="email" required type="email" />
          </label>
          {mode !== 'recovery' && (
            <label>
              Senha
              <input
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={12}
                name="password"
                required
                type="password"
              />
            </label>
          )}
          <button className="primary" disabled={busy} type="submit">
            {mode === 'login' ? 'Entrar' : mode === 'register' ? 'Cadastrar' : 'Enviar link'}
          </button>
        </form>
        {message && <p role="status">{message}</p>}
        <div className="link-actions">
          {mode !== 'register' && (
            <button type="button" onClick={() => setMode('register')}>
              Criar conta
            </button>
          )}
          {mode !== 'recovery' && (
            <button type="button" onClick={() => setMode('recovery')}>
              Esqueci minha senha
            </button>
          )}
          {mode !== 'login' && (
            <button type="button" onClick={() => setMode('login')}>
              Voltar para entrar
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
