import { useEffect, useState } from 'react';

import { type AppApi, browserApi, type PrivacyDocumentView } from './auth-client';
import { AccountScreen } from './components/AccountScreen';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { SyncPanel } from './components/SyncPanel';
import { clearOfflineIdentity, readOfflineIdentity, recordOnlineIdentity } from './offline-auth';
import { deleteUserSyncDatabase } from './sync/local-database';
import { useSyncRuntime } from './sync/use-sync-runtime';

type View = 'account' | 'home' | 'loading' | 'offline-locked' | 'onboarding' | 'public';

export function App({ api = browserApi }: { api?: AppApi }) {
  const resetToken =
    window.location.pathname === '/reset-password'
      ? new URLSearchParams(window.location.search).get('token')
      : null;
  const [view, setView] = useState<View>('loading');
  const [name, setName] = useState('');
  const [documents, setDocuments] = useState<PrivacyDocumentView[]>([]);
  const [offline, setOffline] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const sync = useSyncRuntime(api === browserApi ? userId : null);

  useEffect(() => {
    if (resetToken) return;
    let active = true;
    void api
      .getSession()
      .then(async (session) => {
        if (!active) return;
        if (!session) {
          setView('public');
          return;
        }
        setName(session.user.name);
        setUserId(session.user.id);
        recordOnlineIdentity({ name: session.user.name, userId: session.user.id });
        try {
          const profile = await api.getProfile();
          if (active) {
            setName(profile.displayName);
            setView('home');
          }
        } catch {
          const privacy = await api.listPrivacyDocuments();
          if (active) {
            setDocuments(privacy.documents);
            setView('onboarding');
          }
        }
      })
      .catch(() => {
        const cached = readOfflineIdentity();
        if (cached.allowed && cached.identity) {
          setName(cached.identity.name);
          setUserId(cached.identity.userId);
          setOffline(true);
          setView('home');
        } else if (cached.reason === 'expired') {
          setView('offline-locked');
        } else {
          setView('public');
        }
      });
    return () => {
      active = false;
    };
  }, [api, resetToken]);

  if (resetToken) return <ResetPasswordScreen api={api} token={resetToken} />;

  if (view === 'loading') {
    return (
      <main className="centered-layout" aria-busy="true">
        <p>Carregando…</p>
      </main>
    );
  }
  if (view === 'public') return <AuthScreen api={api} />;
  if (view === 'offline-locked') {
    return (
      <main className="centered-layout">
        <section className="card">
          <p className="eyebrow">Proteção do dispositivo</p>
          <h1>Reconecte para continuar</h1>
          <p>
            Já se passaram mais de 30 dias desde a última autenticação online. Seus dados e
            alterações pendentes continuam preservados.
          </p>
        </section>
      </main>
    );
  }
  if (view === 'onboarding') {
    return (
      <OnboardingScreen
        documents={documents}
        onComplete={async (profile, versions) => {
          await api.saveProfile(profile);
          await api.acceptPrivacy({ documentVersions: versions });
          setName(String(profile.displayName));
          setView('home');
        }}
      />
    );
  }
  if (view === 'account') {
    return (
      <AccountScreen
        api={api}
        onAccountDeleted={async () => {
          if (userId) await deleteUserSyncDatabase(userId);
          clearOfflineIdentity();
          setUserId(null);
          setView('public');
        }}
        onBack={() => setView('home')}
      />
    );
  }

  return (
    <main className="centered-layout">
      <section className="card home-card">
        <p className="eyebrow">Acompanhamento pessoal</p>
        <h1>Torkout</h1>
        <p>Olá, {name}. Seu perfil está pronto.</p>
        {offline && (
          <p role="status">Você está no modo offline. A sincronização aguardará a conexão.</p>
        )}
        <SyncPanel
          conflicts={sync.conflicts}
          onExport={() => void sync.exportPending()}
          onResolve={(id, choice) => void sync.resolve(id, choice)}
          onRetry={() => void sync.retry()}
          onSync={() => void sync.sync()}
          pendingCount={sync.snapshot.pendingCount}
          pendingOperations={sync.pendingOperations}
          state={offline ? 'offline' : sync.snapshot.state}
        />
        <button
          className="primary"
          disabled={offline}
          type="button"
          onClick={() => setView('account')}
        >
          Minha conta
        </button>
        <button type="button" onClick={() => void signOut(false)}>
          Sair e manter dados neste dispositivo
        </button>
        <button type="button" onClick={() => void signOut(true)}>
          Sair e remover dados deste dispositivo
        </button>
      </section>
    </main>
  );

  async function signOut(removeLocalData: boolean): Promise<void> {
    await api.signOut();
    if (removeLocalData && userId) await deleteUserSyncDatabase(userId);
    clearOfflineIdentity();
    setUserId(null);
    setView('public');
  }
}
