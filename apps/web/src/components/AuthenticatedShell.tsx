import type { ReactNode } from 'react';

import { syncStateMessage } from '../presentation';
import type { SyncState } from '../sync/sync-coordinator';
import { SyncPanel } from './SyncPanel';
import { Icon, type IconName } from './ui';
import type { LocalConflict, OutboxEntry } from '../sync/local-database';
import { BrandMark } from './BrandMark';

export type AuthenticatedView =
  'account' | 'analytics' | 'history' | 'photos' | 'planning' | 'progression' | 'today';

const destinations: Array<{ icon: IconName; label: string; view: AuthenticatedView }> = [
  { icon: 'home', label: 'Hoje', view: 'today' },
  { icon: 'calendar', label: 'Planejamento', view: 'planning' },
  { icon: 'history', label: 'Histórico', view: 'history' },
  { icon: 'analytics', label: 'Progresso', view: 'analytics' },
  { icon: 'account', label: 'Conta', view: 'account' },
];

interface Props {
  children: ReactNode;
  conflicts: Array<Omit<LocalConflict, 'operationId'>>;
  name: string;
  onExport(): void;
  onNavigate(view: AuthenticatedView): void;
  onResolve(id: string, choice: 'local' | 'server'): void;
  onRetry(): void;
  onSync(): void;
  pendingCount: number;
  pendingOperations?: OutboxEntry[];
  state: SyncState;
  version?: string;
  view: AuthenticatedView;
}

export function AuthenticatedShell(props: Props) {
  const unhealthy = props.state !== 'synced';
  const version = props.version ?? import.meta.env.VITE_APP_VERSION ?? 'desenvolvimento';
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <button className="brand-lockup" type="button" onClick={() => props.onNavigate('today')}>
          <BrandMark />
          <span>TORKOUT</span>
        </button>
        <button
          className="sidebar-account"
          type="button"
          onClick={() => props.onNavigate('account')}
        >
          <span className="avatar" aria-hidden="true">
            {props.name.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{props.name}</strong>
            <small>Minha conta</small>
          </span>
        </button>
        <small className="sidebar-version">Versão {version}</small>
      </aside>
      <div className="app-column">
        <header className="app-header">
          <button className="mobile-brand" type="button" onClick={() => props.onNavigate('today')}>
            <BrandMark />
            <strong>TORKOUT</strong>
          </button>
          <details className={`sync-popover sync-popover--${props.state}`}>
            <summary aria-label="Abrir detalhes da sincronização">
              <span className="sync-dot" aria-hidden="true" />
              <span>
                {props.pendingCount > 0
                  ? `${props.pendingCount} pendente${props.pendingCount === 1 ? '' : 's'}`
                  : syncShortLabel(props.state)}
              </span>
              <Icon name="chevron-down" size={16} />
            </summary>
            <div className="sync-popover__panel">
              <SyncPanel
                conflicts={props.conflicts}
                onExport={props.onExport}
                onResolve={props.onResolve}
                onRetry={props.onRetry}
                onSync={props.onSync}
                pendingCount={props.pendingCount}
                {...(props.pendingOperations ? { pendingOperations: props.pendingOperations } : {})}
                state={props.state}
              />
            </div>
          </details>
        </header>
        {unhealthy && (
          <div className={`global-status global-status--${props.state}`} role="status">
            <Icon
              name={props.state === 'conflict' || props.state === 'error' ? 'warning' : 'refresh'}
              size={16}
            />
            {syncStateMessage(props.state)}
          </div>
        )}
        <div className="page-outlet">{props.children}</div>
      </div>
      <PrimaryNavigation {...props} />
    </div>
  );
}

function PrimaryNavigation({ onNavigate, view }: Pick<Props, 'onNavigate' | 'view'>) {
  return (
    <nav aria-label="Navegação principal" className="primary-navigation">
      {destinations.map((item) => (
        <button
          aria-current={view === item.view ? 'page' : undefined}
          key={item.view}
          type="button"
          onClick={() => onNavigate(item.view)}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function syncShortLabel(state: SyncState): string {
  return {
    'auth-required': 'Reconectar',
    conflict: 'Conflito',
    error: 'Erro',
    offline: 'Offline',
    pending: 'Pendente',
    synced: 'Sincronizado',
    syncing: 'Sincronizando',
  }[state];
}
