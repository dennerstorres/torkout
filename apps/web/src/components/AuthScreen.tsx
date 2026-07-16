import { type FormEvent, useEffect, useId, useRef, useState } from 'react';

import type { AppApi } from '../auth-client';
import { BrandMark } from './BrandMark';

type Mode = 'login' | 'recovery' | 'register';

const modeTitle: Record<Mode, string> = {
  login: 'Entre no Torkout',
  recovery: 'Recupere sua senha',
  register: 'Crie sua conta',
};

export function AuthScreen({
  api,
  version = import.meta.env.VITE_APP_VERSION ?? 'desenvolvimento',
}: {
  api: AppApi;
  version?: string;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (mode) closeButtonRef.current?.focus();
  }, [mode]);

  function open(nextMode: Mode): void {
    if (!mode && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
    setMessage('');
    setMode(nextMode);
  }

  function close(): void {
    if (busy) return;
    setMessage('');
    setMode(null);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!mode) return;
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
      <header className="auth-header">
        <a className="auth-wordmark" href="#main-content" aria-label="Torkout, início">
          <BrandMark />
          <span>Torkout</span>
        </a>
        <nav aria-label="Acesso" className="auth-navigation">
          <button type="button" onClick={() => open('login')}>
            Entrar
          </button>
          <button className="primary" type="button" onClick={() => open('register')}>
            Criar conta
          </button>
        </nav>
      </header>

      <section className="auth-hero" aria-labelledby="auth-landing-title">
        <div className="auth-hero-copy">
          <p className="eyebrow">Acompanhamento pessoal, sem ruído</p>
          <h1 id="auth-landing-title">Seu treino, claro até nos dias corridos.</h1>
          <p className="auth-lead">
            Planeje a semana, registre o que realmente fez e acompanhe sua evolução em um só lugar,
            inclusive offline.
          </p>
          <div className="auth-hero-actions">
            <button className="primary" type="button" onClick={() => open('register')}>
              Começar agora
            </button>
            <button type="button" onClick={() => open('login')}>
              Já tenho conta
            </button>
          </div>
          <ul className="auth-assurances" aria-label="Características do Torkout">
            <li>Dados sob seu controle</li>
            <li>Funciona offline</li>
            <li>Sem promessas médicas</li>
          </ul>
        </div>

        <aside className="auth-preview" aria-label="Visão geral do aplicativo">
          <p className="eyebrow">Hoje</p>
          <div className="auth-preview-heading">
            <div>
              <strong>Treino principal</strong>
              <span>Força · 18:00</span>
            </div>
            <span className="auth-preview-status">Planejado</span>
          </div>
          <div className="auth-preview-rule" />
          <dl className="auth-preview-metrics">
            <div>
              <dt>Semana</dt>
              <dd>3 sessões</dd>
            </div>
            <div>
              <dt>Próximo passo</dt>
              <dd>Treino A</dd>
            </div>
          </dl>
          <p className="auth-preview-note">O plano ajuda. Você continua no comando.</p>
        </aside>
      </section>

      <footer className="auth-footer">
        <span>Privacidade e portabilidade desde o primeiro registro.</span>
        <span>© 2026 Torkout · Versão {version}</span>
      </footer>

      {mode && (
        <div
          className="auth-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            aria-labelledby={dialogTitleId}
            aria-modal="true"
            className="auth-dialog"
            role="dialog"
            onKeyDown={(event) => {
              if (event.key === 'Escape') close();
              if (event.key === 'Tab') {
                const controls = Array.from(
                  event.currentTarget.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled])',
                  ),
                );
                const first = controls[0];
                const last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <div className="auth-dialog-header">
              <div>
                <p className="eyebrow">Acesso seguro</p>
                <h2 id={dialogTitleId}>{modeTitle[mode]}</h2>
              </div>
              <button
                aria-label="Fechar"
                className="auth-dialog-close"
                disabled={busy}
                ref={closeButtonRef}
                type="button"
                onClick={close}
              >
                ×
              </button>
            </div>
            <form className="auth-form" onSubmit={(event) => void submit(event)}>
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
            <div className="link-actions auth-dialog-links">
              {mode !== 'register' && (
                <button type="button" onClick={() => open('register')}>
                  Criar conta
                </button>
              )}
              {mode !== 'recovery' && (
                <button type="button" onClick={() => open('recovery')}>
                  Esqueci minha senha
                </button>
              )}
              {mode !== 'login' && (
                <button type="button" onClick={() => open('login')}>
                  Voltar para entrar
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
