export class GoogleCalendarError extends Error {
  status: number | null;
  /** Código de error de Google (ej. `invalid_grant`) cuando viene en la respuesta. */
  code: string | null;

  constructor(message: string, status: number | null = null, code: string | null = null) {
    super(message);
    this.name = "GoogleCalendarError";
    this.status = status;
    this.code = code;
  }

  /** El refresh token ya no sirve (revocado/expirado): hay que reconectar la cuenta. */
  get isAuthRevoked(): boolean {
    return this.code === "invalid_grant" || this.status === 401;
  }
}

export class GoogleCalendarNotConfiguredError extends GoogleCalendarError {
  constructor() {
    super(
      "Google Calendar no está configurado en el servidor (GOOGLE_CALENDAR_CLIENT_ID / CLIENT_SECRET / REDIRECT_URI)",
    );
    this.name = "GoogleCalendarNotConfiguredError";
  }
}

/** Mensaje para el usuario final a partir de cualquier error de Google Calendar. */
export function friendlyGoogleCalendarError(err: unknown): string {
  if (err instanceof GoogleCalendarNotConfiguredError) {
    return "Google Calendar no está disponible en este momento. Contacta a soporte.";
  }
  if (err instanceof GoogleCalendarError) {
    if (err.isAuthRevoked) {
      return "Google revocó el acceso a esta cuenta. Vuelve a conectarla.";
    }
    return `Google Calendar: ${err.message}`;
  }
  return err instanceof Error ? err.message : "Error inesperado con Google Calendar";
}
