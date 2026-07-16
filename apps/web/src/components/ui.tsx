import {
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

export type IconName =
  | 'account'
  | 'analytics'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'history'
  | 'home'
  | 'refresh'
  | 'sparkles'
  | 'warning';

const paths: Record<IconName, ReactNode> = {
  account: (
    <>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4m8-4v4M3 10h18" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5m4-1v5l3 2" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v11h14V10M9 21v-7h6v7" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7h-5V2" />
      <path d="M20 7a9 9 0 1 0 1 8" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4L12 2Z" />
      <path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5m0 3h.01" />
    </>
  ),
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="visually-hidden">{children}</span>;
}

export function Button({
  className = '',
  variant = 'secondary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  return <button className={`button button--${variant} ${className}`.trim()} {...props} />;
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`.trim()} {...props} />;
}

export function Surface({
  className = '',
  density = 'standard',
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  density?: 'compact' | 'standard' | 'spacious';
  variant?: 'default' | 'raised' | 'highlighted';
}) {
  return (
    <div
      className={`surface surface--${density} surface--${variant} ${className}`.trim()}
      {...props}
    />
  );
}

export function Section({
  actions,
  children,
  className = '',
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  title: string;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={`section ${className}`.trim()}>
      <header className="section__header">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={titleId}>{title}</h2>
        </div>
        {actions && <div className="section__actions">{actions}</div>}
      </header>
      <div className="section__content">{children}</div>
    </section>
  );
}

export function Panel({
  children,
  className = '',
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  const titleId = useId();
  return (
    <aside aria-labelledby={titleId} className={`panel ${className}`.trim()}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </aside>
  );
}

export function FormGroup({
  children,
  className = '',
  legend,
}: {
  children: ReactNode;
  className?: string;
  legend: string;
}) {
  return (
    <fieldset className={`form-group ${className}`.trim()}>
      <legend>{legend}</legend>
      <div className="form-group__content">{children}</div>
    </fieldset>
  );
}

export function Field({
  hint,
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { hint?: string; label: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input aria-label={props['aria-label'] ?? label} {...props} id={id} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function EmptyState({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon name="sparkles" size={24} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  const labelId = useId();
  return (
    <div aria-labelledby={labelId} className="metric-card" role="group">
      <span className="metric-card__label" id={labelId}>
        {label}
      </span>
      <strong className="metric-card__value">{value}</strong>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children}
      </div>
    </header>
  );
}

export function ProgressBar({ label, value }: { label: string; value: number }) {
  const normalized = Math.min(100, Math.max(0, value));
  return (
    <div className="progress-bar">
      <div className="progress-bar__label">
        <span>{label}</span>
        <strong>{normalized}%</strong>
      </div>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalized}
        role="progressbar"
      >
        <span style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}
