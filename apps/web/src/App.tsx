import { useEffect, useState } from 'react';

import { type AppApi, browserApi, type PrivacyDocumentView } from './auth-client';
import { AccountScreen } from './components/AccountScreen';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { PlanningScreen } from './components/PlanningScreen';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { SyncPanel } from './components/SyncPanel';
import { TodayScreen } from './components/TodayScreen';
import { clearOfflineIdentity, readOfflineIdentity, recordOnlineIdentity } from './offline-auth';
import { deleteUserSyncDatabase, entityKey, type UserSyncDatabase } from './sync/local-database';
import { useSyncRuntime } from './sync/use-sync-runtime';

type View =
  | 'account'
  | 'home'
  | 'loading'
  | 'offline-locked'
  | 'onboarding'
  | 'planning'
  | 'public'
  | 'today';

function civilDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function cacheDailyData(
  database: UserSyncDatabase,
  groups: Array<{
    entityType:
      'body_measurement' | 'habit_definition' | 'habit_entry' | 'pain_report' | 'workout_session';
    items: Array<Record<string, unknown>>;
  }>,
): Promise<void> {
  for (const group of groups) {
    for (const item of group.items) {
      const id = typeof item.id === 'string' ? item.id : null;
      const version = typeof item.version === 'number' ? item.version : null;
      if (!id || !version) continue;
      const key = entityKey(group.entityType, id);
      const current = await database.records.get(key);
      if (current?.syncStatus === 'pending' || current?.syncStatus === 'conflict') continue;
      await database.records.put({
        data: item,
        deletedAt: null,
        entityId: id,
        entityType: group.entityType,
        key,
        syncStatus: 'synced',
        updatedAt: new Date().toISOString(),
        version,
      });
    }
  }
}

export function App({ api = browserApi }: { api?: AppApi }) {
  const resetToken =
    window.location.pathname === '/reset-password'
      ? new URLSearchParams(window.location.search).get('token')
      : null;
  const [view, setView] = useState<View>('loading');
  const [name, setName] = useState('');
  const [documents, setDocuments] = useState<PrivacyDocumentView[]>([]);
  const [offline, setOffline] = useState(false);
  const [timeZone, setTimeZone] = useState('America/Cuiaba');
  const [userId, setUserId] = useState<string | null>(null);
  const sync = useSyncRuntime(api === browserApi ? userId : null);

  useEffect(() => {
    const online = () => setOffline(false);
    const offlineNow = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', offlineNow);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offlineNow);
    };
  }, []);

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
            setTimeZone(profile.timeZone ?? 'America/Cuiaba');
            recordOnlineIdentity({
              name: profile.displayName,
              timeZone: profile.timeZone ?? 'America/Cuiaba',
              userId: session.user.id,
            });
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
          setTimeZone(cached.identity.timeZone ?? 'America/Cuiaba');
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
          setTimeZone(String(profile.timeZone ?? 'America/Cuiaba'));
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
  if (view === 'planning' && sync.database) {
    return (
      <PlanningScreen
        database={sync.database}
        onBack={() => setView('home')}
        onSync={() => void sync.sync()}
        syncState={offline ? 'offline' : sync.snapshot.state}
      />
    );
  }
  if (view === 'today' && sync.database) {
    return (
      <TodayScreen
        database={sync.database}
        onBack={() => setView('home')}
        {...(offline
          ? {}
          : {
              onImportHistory: async () => {
                await api.importDailyHistory();
                const historical = await api.loadDaily('2026-07-13');
                await cacheDailyData(sync.database!, [
                  { entityType: 'workout_session', items: historical.sessions },
                  { entityType: 'habit_definition', items: historical.habits },
                  { entityType: 'habit_entry', items: historical.habitEntries },
                  { entityType: 'pain_report', items: historical.painReports },
                  { entityType: 'body_measurement', items: historical.measurements },
                ]);
              },
            })}
        onSync={() => void sync.sync()}
        syncState={offline ? 'offline' : sync.snapshot.state}
        timeZone={timeZone}
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
        <button className="primary" type="button" onClick={() => setView('planning')}>
          Planejamento
        </button>
        <button className="primary" type="button" onClick={() => void openToday()}>
          Hoje
        </button>
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

  async function openToday(): Promise<void> {
    if (sync.database && !offline) {
      try {
        const daily = await api.loadDaily(civilDate(new Date(), timeZone));
        await cacheDailyData(sync.database, [
          { entityType: 'workout_session', items: daily.sessions },
          { entityType: 'habit_definition', items: daily.habits },
          { entityType: 'habit_entry', items: daily.habitEntries },
          { entityType: 'pain_report', items: daily.painReports },
          { entityType: 'body_measurement', items: daily.measurements },
        ]);
      } catch {
        // The local replica remains usable when hydration is unavailable.
      }
    }
    setView('today');
  }
}
