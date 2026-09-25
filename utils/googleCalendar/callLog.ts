import { KeystoneContext } from "@keystone-6/core/types";
import type { GoogleSyncDirection, GoogleSyncOperation } from "./constants";

export type PersistGoogleCalendarSyncLogParams = {
  context: KeystoneContext;
  accountId?: string | null;
  direction: GoogleSyncDirection;
  operation: GoogleSyncOperation;
  success: boolean;
  errorMessage?: string | null;
  durationMs?: number | null;
};

/**
 * Persiste una llamada a Google Calendar. Nunca lanza: un fallo de log no debe tumbar
 * la operación que lo disparó (mismo criterio que utils/ai/callLog.ts).
 */
export async function persistGoogleCalendarSyncLog(
  params: PersistGoogleCalendarSyncLogParams,
): Promise<void> {
  if (!params.accountId) return;
  try {
    await params.context.sudo().query.TechGoogleCalendarSyncLog.createOne({
      data: {
        account: { connect: { id: params.accountId } },
        direction: params.direction,
        operation: params.operation,
        success: params.success,
        errorMessage: params.errorMessage ?? null,
        durationMs: params.durationMs ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to persist TechGoogleCalendarSyncLog:", err);
  }
}
