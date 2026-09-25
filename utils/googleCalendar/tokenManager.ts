import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt, encrypt } from "../helpers/encryption";
import { persistGoogleCalendarSyncLog } from "./callLog";
import { GoogleCalendarError } from "./errors";
import { refreshAccessToken } from "./oauth";

/** Campos de GoogleCalendarAccount necesarios para obtener un access token válido. */
export const ACCOUNT_TOKEN_QUERY =
  "id isActive accessTokenEncrypted refreshTokenEncrypted tokenExpiresAt";

export type AccountTokenRecord = {
  id: string;
  isActive?: boolean | null;
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  tokenExpiresAt?: string | null;
};

const EXPIRY_SKEW_MS = 60_000;

/**
 * Devuelve un access token vigente. Si expiró (o está por expirar) lo refresca con el
 * refresh token y persiste el nuevo (cifrado). Si Google indica que el refresh token ya
 * no sirve, marca la cuenta como inactiva para que el usuario la reconecte.
 */
export async function getValidAccessToken(
  context: KeystoneContext,
  account: AccountTokenRecord,
): Promise<string> {
  if (account.isActive === false) {
    throw new GoogleCalendarError(
      "La cuenta de Google está desconectada; vuelve a conectarla",
      401,
      "invalid_grant",
    );
  }

  const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : 0;
  if (account.accessTokenEncrypted && expiresAt - Date.now() > EXPIRY_SKEW_MS) {
    return decrypt(account.accessTokenEncrypted);
  }

  if (!account.refreshTokenEncrypted) {
    throw new GoogleCalendarError("La cuenta no tiene refresh token", 401, "invalid_grant");
  }

  const startedAt = Date.now();
  try {
    const refreshed = await refreshAccessToken(decrypt(account.refreshTokenEncrypted));
    await context.sudo().query.GoogleCalendarAccount.updateOne({
      where: { id: account.id },
      data: {
        accessTokenEncrypted: encrypt(refreshed.accessToken),
        tokenExpiresAt: new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString(),
      },
    });
    await persistGoogleCalendarSyncLog({
      context,
      accountId: account.id,
      direction: "pull",
      operation: "token_refresh",
      success: true,
      durationMs: Date.now() - startedAt,
    });
    return refreshed.accessToken;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al refrescar token";
    if (err instanceof GoogleCalendarError && err.isAuthRevoked) {
      await context
        .sudo()
        .query.GoogleCalendarAccount.updateOne({
          where: { id: account.id },
          data: { isActive: false, lastSyncError: message },
        })
        .catch((e: unknown) => console.error("No se pudo desactivar la cuenta:", e));
    }
    await persistGoogleCalendarSyncLog({
      context,
      accountId: account.id,
      direction: "pull",
      operation: "token_refresh",
      success: false,
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}
