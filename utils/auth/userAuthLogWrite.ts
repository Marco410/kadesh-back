import { KeystoneContext } from "@keystone-6/core/types";
import type { UserAuthLogSource } from "../../models/User/UserAuthLog/constants";

function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return "***";
  if (local.length <= 2) return `**@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

type WriteUserAuthLogParams = {
  startedAt: number;
  source: UserAuthLogSource;
  step: string;
  success: boolean;
  message: string;
  email: string;
  userId?: string | null;
  responseSnapshot?: Record<string, unknown> | null;
};

/**
 * Persist auth/register events. Never throws; never stores session tokens.
 */
export async function writeUserAuthLog(
  context: KeystoneContext,
  params: WriteUserAuthLogParams,
): Promise<void> {
  try {
    const durationMs = Date.now() - params.startedAt;
    const snapshot = params.responseSnapshot ?? undefined;
    await context.sudo().query.UserAuthLog.createOne({
      data: {
        source: params.source,
        step: params.step,
        success: params.success,
        message: params.message,
        emailMasked: maskEmail(params.email),
        durationMs,
        responseSnapshot: snapshot,
        ...(params.userId ? { user: { connect: { id: params.userId } } } : {}),
      },
    });
  } catch {
    // ignore
  }
}
