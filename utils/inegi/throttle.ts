const DEFAULT_DELAY_MS = 400;
const MAX_RETRIES = 3;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function throttle(delayMs = DEFAULT_DELAY_MS): Promise<void> {
  await sleep(delayMs);
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Fetch con espera previa, retries y backoff ante 429/5xx.
 * INEGI no documenta un rate limit público; no asumir que no existe.
 */
export async function inegiFetch(
  url: string,
  options?: { delayMs?: number; retries?: number },
): Promise<Response> {
  const retries = options?.retries ?? MAX_RETRIES;
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0 || delayMs > 0) {
      const backoff = attempt === 0 ? delayMs : delayMs * 2 ** (attempt - 1);
      await sleep(backoff);
    }
    try {
      const res = await fetch(url);
      if (isRetryableStatus(res.status) && attempt < retries) {
        lastError = new Error(`INEGI HTTP ${res.status}`);
        console.warn("[INEGI fetch] retryable HTTP status", {
          status: res.status,
          attempt: attempt + 1,
          maxAttempts: retries + 1,
        });
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      console.warn("[INEGI fetch] network error", {
        attempt: attempt + 1,
        maxAttempts: retries + 1,
        message: err instanceof Error ? err.message : String(err),
      });
      if (attempt >= retries) break;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudo contactar la API de INEGI");
}
