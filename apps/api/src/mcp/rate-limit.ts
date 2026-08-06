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
