/**
 * Cloudflare Turnstile (captcha sin fricción) para formularios públicos sin cuenta («Lo vi»).
 *
 * Sin `TURNSTILE_SECRET_KEY` está apagado y todo pasa: así se puede desplegar antes de crear el
 * widget en Cloudflare. Con la llave, el token es obligatorio. La web manda el token que le da el
 * widget (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`).
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

export async function verifyTurnstile(token: string | null | undefined, ip?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  const response = token?.trim();
  if (!response) return false;

  const body = new URLSearchParams({ secret, response });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[turnstile] HTTP", res.status);
      return false;
    }
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) console.warn("[turnstile] rechazado:", data["error-codes"]?.join(", "));
    return data.success === true;
  } catch (error) {
    // Si Cloudflare no responde, no se publica: es un formulario sin cuenta.
    console.error("[turnstile] No se pudo verificar:", error);
    return false;
  }
}
