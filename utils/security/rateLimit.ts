/**
 * Límites en memoria por proceso: ventana deslizante por llave (IP, persona, regla…).
 *
 * Se reinicia al desplegar y no se comparte entre réplicas. Alcanza mientras el back corra en una
 * sola instancia de Railway; si se escala, hay que moverlo a la base o a Redis.
 */

export type RateLimitResult = {
  ok: boolean;
  /** Intentos dentro de la ventana, contando este. */
  count: number;
  /** Segundos para que vuelva a haber cupo (0 si `ok`). */
  retryAfterSec: number;
  /** `true` solo la primera vez que esta llave se pasa en la ventana actual (para avisar una vez). */
  firstExceeded: boolean;
};

export type RateLimiter = {
  hit(key: string, now?: number): RateLimitResult;
  /** Consulta sin sumar (p. ej. intentos fallidos de login antes de autenticar). */
  peek(key: string, now?: number): RateLimitResult;
  reset(key: string): void;
};

const SWEEP_EVERY = 500;

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  const exceeded = new Map<string, number>();
  let calls = 0;

  function sweep(now: number) {
    for (const [key, times] of hits) {
      const fresh = times.filter((t) => now - t < windowMs);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
    for (const [key, at] of exceeded) {
      if (now - at >= windowMs) exceeded.delete(key);
    }
  }

  function evaluate(key: string, now: number, add: boolean): RateLimitResult {
    calls += 1;
    if (calls % SWEEP_EVERY === 0) sweep(now);
    const times = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (add) times.push(now);
    if (times.length) hits.set(key, times);
    else hits.delete(key);
    const count = times.length;
    const ok = add ? count <= limit : count < limit;
    if (ok) return { ok, count, retryAfterSec: 0, firstExceeded: false };
    const oldest = times[Math.max(0, times.length - limit)] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    const lastExceeded = exceeded.get(key);
    const firstExceeded = add && (lastExceeded === undefined || now - lastExceeded >= windowMs);
    if (firstExceeded) exceeded.set(key, now);
    return { ok, count, retryAfterSec, firstExceeded };
  }

  return {
    hit: (key, now = Date.now()) => evaluate(key, now, true),
    peek: (key, now = Date.now()) => evaluate(key, now, false),
    reset: (key) => {
      hits.delete(key);
      exceeded.delete(key);
    },
  };
}

/**
 * Deduplicado: `true` la primera vez que se ve una llave; después, `false` hasta que pasa la
 * ventana contada desde ese primer `true` (las repeticiones no la alargan: un error que se repite
 * cada minuto se vuelve a registrar cada `windowMs`).
 */
export function createDeduper(windowMs: number): (key: string, now?: number) => boolean {
  const seen = new Map<string, number>();
  let calls = 0;
  return (key, now = Date.now()) => {
    calls += 1;
    if (calls % SWEEP_EVERY === 0) {
      for (const [k, at] of seen) {
        if (now - at >= windowMs) seen.delete(k);
      }
    }
    const at = seen.get(key);
    if (at !== undefined && now - at < windowMs) return false;
    seen.set(key, now);
    return true;
  };
}
