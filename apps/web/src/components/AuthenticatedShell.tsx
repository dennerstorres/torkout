import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

import { syncStateMessage } from '../presentation';
import type { SyncState } from '../sync/sync-coordinator';
import { SyncPanel } from './SyncPanel';
import { Icon, type IconName } from './ui';
import type { LocalConflict, OutboxEntry } from '../sync/local-database';
import { BrandMark } from './BrandMark';

export type AuthenticatedView =
  'account' | 'analytics' | 'history' | 'photos' | 'planning' | 'progression' | 'today';

const destinations: Array<{
  compactLabel: string;
  icon: IconName;
  label: string;
  view: AuthenticatedView;
}> = [
  { compactLabel: 'Hoje', icon: 'home', label: 'Hoje', view: 'today' },
  { compactLabel: 'Plano', icon: 'calendar', label: 'Planejamento', view: 'planning' },
  { compactLabel: 'Histórico', icon: 'history', label: 'Histórico', view: 'history' },
  { compactLabel: 'Progresso', icon: 'analytics', label: 'Progresso', view: 'analytics' },
];

const menuViews: AuthenticatedView[] = ['account', 'photos', 'progression'];

interface Props {
  children: ReactNode;
  conflicts: Array<Omit<LocalConflict, 'operationId'>>;
  /** Presente somente no modo demonstração; define o aviso permanente e suas ações. */
  demo?: { onExit(): void | Promise<void>; onRestart(): void | Promise<void> };
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
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenuButton = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const unhealthy = props.state !== 'synced';
  const version = props.version ?? import.meta.env.VITE_APP_VERSION ?? 'desenvolvimento';

  useEffect(() => {
    if (menuOpen) closeMenuButton.current?.focus();
  }, [menuOpen]);

  function closeMenu(): void {
    setMenuOpen(false);
    window.setTimeout(() => menuTrigger.current?.focus(), 0);
  }

  function navigateFromMenu(destination: AuthenticatedView): void {
    setMenuOpen(false);
    props.onNavigate(destination);
  }

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
        {props.demo && (
          <div aria-label="Modo demonstração" className="demo-banner" role="status">
            <Icon name="warning" size={16} />
            <p>
              <strong>Modo demonstração.</strong> Os dados são de exemplo e ficam só neste aparelho:
              nada é salvo em servidor algum.
            </p>
            <span className="demo-banner__actions">
              <button type="button" onClick={() => void props.demo?.onRestart()}>
                Recomeçar
              </button>
              <button type="button" onClick={() => void props.demo?.onExit()}>
                Sair da demonstração
              </button>
            </span>
          </div>
        )}
        {unhealthy && !props.demo && (
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
      <PrimaryNavigation
        menuOpen={menuOpen}
        menuTrigger={menuTrigger}
        onMenu={() => setMenuOpen(true)}
        onNavigate={props.onNavigate}
        view={props.view}
      />
      {menuOpen && (
        <div
          className="app-menu-layer"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeMenu();
          }}
        >
          <section
            aria-label="Menu"
            aria-modal="true"
            className="app-menu-sheet"
            role="dialog"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeMenu();
            }}
          >
            <header className="app-menu-heading">
              <div className="app-menu-profile">
                <span className="avatar" aria-hidden="true">
                  {props.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <small>Seu espaço</small>
                  <strong>{props.name}</strong>
                </span>
              </div>
              <button ref={closeMenuButton} type="button" onClick={closeMenu}>
                Fechar menu
              </button>
            </header>
            <div className="app-menu-shortcuts">
              <button aria-label="Conta" type="button" onClick={() => navigateFromMenu('account')}>
                <Icon name="account" size={24} />
                <span>
                  <strong>Conta</strong>
                  <small>Privacidade, sessões e exportação</small>
                </span>
              </button>
              <button
                aria-label="Fotos de evolução"
                type="button"
                onClick={() => navigateFromMenu('photos')}
              >
                <Icon name="image" size={24} />
                <span>
                  <strong>Fotos de evolução</strong>
                  <small>Compare registros nas mesmas condições</small>
                </span>
              </button>
              <button
                aria-label="Sugestões de progressão"
                type="button"
                onClick={() => navigateFromMenu('progression')}
              >
                <Icon name="sparkles" size={24} />
                <span>
                  <strong>Sugestões de progressão</strong>
                  <small>Revise sugestões antes de aplicar</small>
                </span>
              </button>
              <button
                aria-label="Sincronizar agora pelo menu"
                type="button"
                onClick={() => {
                  props.onSync();
                  closeMenu();
                }}
              >
                <Icon name="refresh" size={24} />
                <span>
                  <strong>Sincronizar agora</strong>
                  <small>
                    {props.pendingCount > 0
                      ? `${props.pendingCount} pendente${props.pendingCount === 1 ? '' : 's'}`
                      : syncShortLabel(props.state)}
                  </small>
                </span>
              </button>
            </div>
            <p className="app-menu-version">Torkout {version}</p>
          </section>
        </div>
      )}
    </div>
  );
}

function PrimaryNavigation({
  menuOpen,
  menuTrigger,
  onMenu,
  onNavigate,
  view,
}: Pick<Props, 'onNavigate' | 'view'> & {
  menuOpen: boolean;
  menuTrigger: RefObject<HTMLButtonElement | null>;
  onMenu(): void;
}) {
  return (
    <nav aria-label="Navegação principal" className="primary-navigation">
      {destinations.map((item) => (
        <button
          aria-label={item.label}
          aria-current={view === item.view ? 'page' : undefined}
          key={item.view}
          type="button"
          onClick={() => onNavigate(item.view)}
        >
          <Icon name={item.icon} />
          <span aria-hidden="true" className="navigation-label navigation-label--compact">
            {item.compactLabel}
          </span>
          <span aria-hidden="true" className="navigation-label navigation-label--full">
            {item.label}
          </span>
        </button>
      ))}
      <button
        aria-current={menuOpen || menuViews.includes(view) ? 'page' : undefined}
        aria-expanded={menuOpen}
        aria-label="Menu"
        ref={menuTrigger}
        type="button"
        onClick={onMenu}
      >
        <Icon name="menu" />
        <span aria-hidden="true" className="navigation-label">
          Menu
        </span>
      </button>
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
