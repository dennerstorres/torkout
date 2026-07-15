import type { FastifyRequest, FastifyServerOptions } from 'fastify';

const SECURITY_HEADERS = {
  'content-security-policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "manifest-src 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
  ].join('; '),
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
} as const;

export const LOGGER_REDACT_PATHS = [
  'body',
  'password',
  'req.body',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers.set-cookie',
  'token',
] as const;

export function createLoggerOptions(
  level: 'debug' | 'error' | 'fatal' | 'info' | 'silent' | 'trace' | 'warn',
): FastifyServerOptions['logger'] {
  if (level === 'silent') return false;
  return {
    level,
    redact: {
      censor: '[Redacted]',
      paths: [...LOGGER_REDACT_PATHS],
      remove: false,
    },
    serializers: {
      req(request: FastifyRequest) {
        return {
          id: request.id,
          method: request.method,
          url: request.url.split('?', 1).at(0) ?? request.url,
        };
      },
    },
  };
}

type Metric = {
  count: number;
  durationMs: number;
  method: string;
  route: string;
  statusClass: string;
};

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}

export class OperationalMetrics {
  readonly #requests = new Map<string, Metric>();
  readonly #startedAt = new WeakMap<FastifyRequest, bigint>();

  start(request: FastifyRequest): void {
    this.#startedAt.set(request, process.hrtime.bigint());
  }

  finish(request: FastifyRequest, statusCode: number): void {
    const startedAt = this.#startedAt.get(request);
    if (!startedAt) return;
    const method = request.method;
    const route = request.routeOptions.url || 'unmatched';
    const statusClass = `${Math.floor(statusCode / 100)}xx`;
    const key = `${method}\u0000${route}\u0000${statusClass}`;
    const metric = this.#requests.get(key) ?? {
      count: 0,
      durationMs: 0,
      method,
      route,
      statusClass,
    };
    metric.count += 1;
    metric.durationMs += Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    this.#requests.set(key, metric);
    this.#startedAt.delete(request);
  }

  render(): string {
    const lines = [
      '# HELP torkout_http_requests_total Completed HTTP requests.',
      '# TYPE torkout_http_requests_total counter',
    ];
    const metrics = [...this.#requests.values()].sort((left, right) =>
      `${left.method}${left.route}${left.statusClass}`.localeCompare(
        `${right.method}${right.route}${right.statusClass}`,
      ),
    );
    for (const metric of metrics) {
      const labels = `method="${escapeLabel(metric.method)}",route="${escapeLabel(metric.route)}",status_class="${metric.statusClass}"`;
      lines.push(`torkout_http_requests_total{${labels}} ${metric.count}`);
    }
    lines.push(
      '# HELP torkout_http_request_duration_ms Request duration in milliseconds.',
      '# TYPE torkout_http_request_duration_ms summary',
    );
    for (const metric of metrics) {
      const labels = `method="${escapeLabel(metric.method)}",route="${escapeLabel(metric.route)}",status_class="${metric.statusClass}"`;
      lines.push(
        `torkout_http_request_duration_ms_sum{${labels}} ${metric.durationMs.toFixed(3)}`,
        `torkout_http_request_duration_ms_count{${labels}} ${metric.count}`,
      );
    }
    return `${lines.join('\n')}\n`;
  }
}

export function securityHeaders(production: boolean): Record<string, string> {
  return {
    ...SECURITY_HEADERS,
    ...(production ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {}),
  };
}
