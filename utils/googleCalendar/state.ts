import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";

/**
 * `state` de OAuth: JWT firmado y de vida corta que viaja a Google y regresa en el
 * callback. Ata el consentimiento al usuario/empresa/tipo de cuenta que lo inició y evita
 * que otra sesión (o un `state` fabricado) conecte cuentas donde no debe (CSRF).
 */
export type GoogleCalendarStatePayload = {
  /** userId que inició la conexión */
  uid: string;
  /** companyId sobre el que se conecta */
  cid: string;
  /** scopeType: personal | company */
  st: string;
};

const PURPOSE = "google-calendar-connect";

let devFallbackSecret: string | null = null;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET es requerido para firmar el state de Google Calendar");
  }
  devFallbackSecret ??= randomBytes(32).toString("hex");
  return devFallbackSecret;
}

export function signGoogleCalendarState(payload: GoogleCalendarStatePayload): string {
  return jwt.sign({ ...payload, purpose: PURPOSE }, getSecret(), { expiresIn: "15m" });
}

/** Devuelve el payload, o `null` si el state es inválido, expiró o no es de este flujo. */
export function verifyGoogleCalendarState(
  state: string,
): GoogleCalendarStatePayload | null {
  try {
    const decoded = jwt.verify(state, getSecret()) as Record<string, unknown>;
    if (
      decoded.purpose !== PURPOSE ||
      typeof decoded.uid !== "string" ||
      typeof decoded.cid !== "string" ||
      typeof decoded.st !== "string"
    ) {
      return null;
    }
    return { uid: decoded.uid, cid: decoded.cid, st: decoded.st };
  } catch {
    return null;
  }
}
