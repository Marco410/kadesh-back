import {
  GOOGLE_AUTH_URL,
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_REVOKE_URL,
  GOOGLE_TOKEN_URL,
} from "./constants";
import { GoogleCalendarError, GoogleCalendarNotConfiguredError } from "./errors";

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  scope: string;
};

function getConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new GoogleCalendarNotConfiguredError();
  }
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleCalendarConfigured(): boolean {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * URL de consentimiento. `access_type=offline` + `prompt=consent` fuerzan que Google
 * devuelva refresh_token siempre (también al reconectar la misma cuenta).
 */
export function buildGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function postToken(body: URLSearchParams): Promise<Record<string, any>> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || data.error) {
    throw new GoogleCalendarError(
      data.error_description || data.error || `Google token endpoint respondió ${res.status}`,
      res.status,
      typeof data.error === "string" ? data.error : null,
    );
  }
  return data;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getConfig();
  const data = await postToken(
    new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  );
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresInSeconds: Number(data.expires_in) || 3600,
    scope: data.scope ?? GOOGLE_CALENDAR_SCOPE,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const { clientId, clientSecret } = getConfig();
  const data = await postToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  );
  return {
    accessToken: data.access_token,
    expiresInSeconds: Number(data.expires_in) || 3600,
  };
}

/** Best-effort: si falla no debe impedir desconectar la cuenta en Kadesh. */
export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch (err) {
    console.error("No se pudo revocar el token de Google:", err);
  }
}
