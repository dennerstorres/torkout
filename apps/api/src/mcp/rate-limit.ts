/**
 * Limitador de janela fixa em memória, no mesmo espírito do `rateLimit` do Better Auth já usado na
 * autenticação: suficiente para uma instância única, sem introduzir Redis nem fila externa.
 */
export class FixedWindowRateLimiter {
  readonly #hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Devolve os segundos a esperar quando o limite estourou, ou `null` quando a chamada é aceita. */
  check(key: string, now = Date.now()): number | null {
    const current = this.#hits.get(key);
    if (!current || current.resetAt <= now) {
      this.#hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.#sweep(now);
      return null;
    }
    if (current.count >= this.max) return Math.ceil((current.resetAt - now) / 1_000);
    current.count += 1;
    return null;
  }

  #sweep(now: number): void {
    if (this.#hits.size < 1_000) return;
    for (const [key, entry] of this.#hits) {
      if (entry.resetAt <= now) this.#hits.delete(key);
    }
  }
}

/** Limites por endereço de origem; a integração é pessoal e não precisa de folga generosa. */
export interface McpRateLimits {
  callsPerMinute: number;
  registrationsPerHour: number;
  tokensPerMinute: number;
}

export const DEFAULT_MCP_RATE_LIMITS: McpRateLimits = {
  callsPerMinute: 120,
  registrationsPerHour: 5,
  tokensPerMinute: 30,
};

export interface McpRateLimiters {
  /** Compartilhado por `/mcp` e por `/api/ai/*`: as duas portas são a mesma integração. */
  calls: FixedWindowRateLimiter;
  registrations: FixedWindowRateLimiter;
  tokens: FixedWindowRateLimiter;
}

/**
 * Os limitadores pertencem à aplicação, não ao módulo: duas instâncias no mesmo processo, como
 * acontece nos testes, não podem compartilhar contador.
 */
export function createMcpRateLimiters(
  limits?: Partial<McpRateLimits> | undefined,
): McpRateLimiters {
  const effective = { ...DEFAULT_MCP_RATE_LIMITS, ...limits };
  return {
    calls: new FixedWindowRateLimiter(effective.callsPerMinute, 60 * 1_000),
    registrations: new FixedWindowRateLimiter(effective.registrationsPerHour, 60 * 60 * 1_000),
    tokens: new FixedWindowRateLimiter(effective.tokensPerMinute, 60 * 1_000),
  };
}
