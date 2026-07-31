import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { type AppApi, browserApi, type PrivacyDocumentView } from './auth-client';
import { AccountScreen } from './components/AccountScreen';
import { AuthenticatedShell, type AuthenticatedView } from './components/AuthenticatedShell';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { PlanningScreen } from './components/PlanningScreen';
import { ProgressionScreen } from './components/ProgressionScreen';
import { ProgressPhotosScreen } from './components/ProgressPhotosScreen';
import { PwaExperience } from './components/PwaExperience';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { TodayScreen } from './components/TodayScreen';
import { DesignSystemLab } from './components/DesignSystemLab';
import { clearOfflineIdentity, readOfflineIdentity, recordOnlineIdentity } from './offline-auth';
import { deleteUserSyncDatabase, entityKey, type UserSyncDatabase } from './sync/local-database';
import { useSyncRuntime } from './sync/use-sync-runtime';

const AnalyticsScreen = lazy(() =>
  import('./components/AnalyticsScreen').then((module) => ({ default: module.AnalyticsScreen })),
);

type View =
  | 'account'
  | 'analytics'
  | 'home'
  | 'history'
  | 'loading'
  | 'offline-locked'
  | 'onboarding'
  | 'photos'
  | 'planning'
  | 'public'
  | 'progression'
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

export function App({
  api = browserApi,
  signUpEnabled = import.meta.env.VITE_PUBLIC_SIGNUP_ENABLED === 'true',
}: {
  api?: AppApi;
  /** Cadastro público; o padrão é fechado. Ver `PUBLIC_SIGNUP_ENABLED` na API. */
  signUpEnabled?: boolean;
}) {
  if (window.location.pathname === '/design-system') return <DesignSystemLab />;
  return (
    <>
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo principal
      </a>
      <PwaExperience />
      <div id="main-content" tabIndex={-1}>
        <AppContent api={api} signUpEnabled={signUpEnabled} />
      </div>
    </>
  );
}

function AppContent({ api, signUpEnabled }: { api: AppApi; signUpEnabled: boolean }) {
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
  const sync = useSyncRuntime(userId);
  const previousView = useRef<View>(view);
  const photoApi = useMemo(
    () => ({
      contentUrl: (id: string) => api.progressPhotoUrl(id),
      list: () => api.listProgressPhotos(),
      remove: (id: string) => api.deleteProgressPhoto(id),
      upload: (input: Record<string, unknown>) => api.uploadProgressPhoto(input),
    }),
    [api],
  );

  useEffect(() => {
    const from = previousView.current;
    previousView.current = view;
    if (from === 'loading') return;
    const heading = document.querySelector<HTMLElement>('#main-content main h1');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
  }, [view]);
  const loadHistoryRange = useCallback(
    async (from: string, through: string) => {
      if (!sync.database) return;
      let cursor: string | undefined;
      const visited = new Set<string>();
      do {
        const page = await api.loadHistoryPage(from, through, cursor);
        await cacheDailyData(sync.database, [
          { entityType: 'habit_definition', items: page.habits },
          {
            entityType: 'workout_session',
            items: page.days.flatMap((day) => day.sessions),
          },
          {
            entityType: 'habit_entry',
            items: page.days.flatMap((day) => day.habitEntries),
          },
          {
            entityType: 'pain_report',
            items: page.days.flatMap((day) => day.painReports),
          },
          {
            entityType: 'body_measurement',
            items: page.days.flatMap((day) => day.measurements),
          },
        ]);
        cursor = page.nextCursor ?? undefined;
        if (cursor && visited.has(cursor)) throw new Error('HISTORY_CURSOR_LOOP');
        if (cursor) visited.add(cursor);
      } while (cursor);
    },
    [api, sync.database],
  );

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

  const openToday = useCallback(async (): Promise<void> => {
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
  }, [api, offline, sync.database, timeZone]);

  useEffect(() => {
    if (view !== 'home' || !sync.database) return;
    const timer = window.setTimeout(() => void openToday(), 0);
    return () => window.clearTimeout(timer);
  }, [openToday, sync.database, view]);

  if (resetToken) return <ResetPasswordScreen api={api} token={resetToken} />;

  if (view === 'loading') {
    return (
      <main className="centered-layout" aria-busy="true">
        <p>Carregando…</p>
      </main>
    );
  }
  if (view === 'public') return <AuthScreen api={api} signUpEnabled={signUpEnabled} />;
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
  if (view === 'home') {
    if (offline && !sync.database) {
      return (
        <main className="centered-layout">
          <section className="card">
            <p className="eyebrow">Modo offline</p>
            <h1>Olá, {name}</h1>
            <p role="status">
              Você está no modo offline. Reconecte para abrir os dados sincronizados neste
              dispositivo.
            </p>
          </section>
        </main>
      );
    }
    return (
      <main className="centered-layout" aria-busy="true">
        <p>Preparando seus dados…</p>
      </main>
    );
  }

  let page: ReactNode;
  if (view === 'account') {
    page = (
      <AccountScreen
        api={api}
        {...(sync.database ? { database: sync.database } : {})}
        onAccountDeleted={async () => {
          if (userId) await deleteUserSyncDatabase(userId);
          clearOfflineIdentity();
          setUserId(null);
          setView('public');
        }}
        onBack={() => setView('today')}
        onSignOut={(removeLocalData) => signOut(removeLocalData)}
      />
    );
  } else if (view === 'planning' && sync.database) {
    page = (
      <PlanningScreen
        database={sync.database}
        onBack={() => setView('today')}
        syncState={offline ? 'offline' : sync.snapshot.state}
      />
    );
  } else if (view === 'today' && sync.database) {
    page = (
      <TodayScreen
        database={sync.database}
        name={name}
        onBack={() => setView('today')}
        onPlan={() => setView('planning')}
        syncState={offline ? 'offline' : sync.snapshot.state}
        timeZone={timeZone}
      />
    );
  } else if (view === 'history' && sync.database) {
    page = (
      <HistoryScreen
        database={sync.database}
        initialMonth={civilDate(new Date(), timeZone).slice(0, 7)}
        onBack={() => setView('today')}
        {...(offline ? {} : { onLoadRange: loadHistoryRange })}
        today={civilDate(new Date(), timeZone)}
      />
    );
  } else if (view === 'analytics' && sync.database) {
    page = (
      <Suspense
        fallback={
          <main className="analytics-layout analytics-route-loading" aria-busy="true">
            <header className="analytics-header">
              <div>
                <p className="eyebrow">Indicadores pessoais</p>
                <h1>Progresso</h1>
              </div>
            </header>
            <p className="sync-note" role="status">
              Carregando indicadores…
            </p>
          </main>
        }
      >
        <AnalyticsScreen
          database={sync.database}
          onBack={() => setView('today')}
          onProgression={() => setView('progression')}
          onPhotos={() => setView('photos')}
          {...(offline
            ? {}
            : {
                onLoad: (from: string, through: string) => api.loadProgressAnalytics(from, through),
                onLoadPanel: (from: string, through: string) =>
                  api.loadProgressPanel(from, through),
              })}
          today={civilDate(new Date(), timeZone)}
        />
      </Suspense>
    );
  } else if (view === 'photos') {
    page = (
      <ProgressPhotosScreen
        api={photoApi}
        onBack={() => setView('analytics')}
        today={civilDate(new Date(), timeZone)}
      />
    );
  } else if (view === 'progression') {
    page = <ProgressionScreen api={api} onBack={() => setView('analytics')} />;
  } else {
    return (
      <main className="centered-layout" aria-busy="true">
        <p>Abrindo dados locais…</p>
      </main>
    );
  }

  return (
    <AuthenticatedShell
      conflicts={sync.conflicts}
      name={name}
      onExport={() => void sync.exportPending()}
      onNavigate={(destination) => void navigate(destination)}
      onResolve={(id, choice) => void sync.resolve(id, choice)}
      onRetry={() => void sync.retry()}
      onSync={() => void sync.sync()}
      pendingCount={sync.snapshot.pendingCount}
      pendingOperations={sync.pendingOperations}
      state={offline ? 'offline' : sync.snapshot.state}
      view={view}
    >
      {page}
    </AuthenticatedShell>
  );

  async function navigate(destination: AuthenticatedView): Promise<void> {
    if (destination === 'today') await openToday();
    else setView(destination);
  }

  async function signOut(removeLocalData: boolean): Promise<void> {
    await api.signOut();
    if (removeLocalData && userId) await deleteUserSyncDatabase(userId);
    clearOfflineIdentity();
    setUserId(null);
    setView('public');
  }
}
