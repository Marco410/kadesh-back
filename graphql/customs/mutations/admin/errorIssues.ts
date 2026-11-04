import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import {
  ERROR_ISSUE_STATUS,
  ERROR_ISSUE_STATUS_VALUES,
} from "../../../../models/ErrorIssue/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";

/**
 * Bandeja de Errores (fase 6.2): un admin marca un error agrupado como resuelto, ignorado o lo
 * reabre, con una nota. Guarda el estado en `ErrorIssue` (una fila por `fingerprint`).
 * `AdminOpsActionResult` se declara en `companyOps.ts`.
 */

const typeDefs = `
  type Mutation {
    """status: open | resolved | ignored"""
    adminSetErrorIssueStatus(fingerprint: ID!, status: String!, note: String): AdminOpsActionResult!
  }
`;

const definition = `
  adminSetErrorIssueStatus(fingerprint: ID!, status: String!, note: String): AdminOpsActionResult!
`;

const STATUS_LABELS: Record<string, string> = {
  [ERROR_ISSUE_STATUS.OPEN]: "reabrió",
  [ERROR_ISSUE_STATUS.RESOLVED]: "marcó resuelto",
  [ERROR_ISSUE_STATUS.IGNORED]: "ignoró",
};

const MAX_NOTE = 2000;

function result(success: boolean, message: string) {
  return { success, message };
}

const resolver = {
  adminSetErrorIssueStatus: async (
    _root: unknown,
    args: { fingerprint: string; status: string; note?: string | null },
    context: KeystoneContext,
  ) => {
    if (!isPlatformAdmin(context.session)) {
      return result(false, "Solo un administrador de Kadesh puede hacer esto.");
    }
    const fingerprint = args.fingerprint?.trim();
    const status = args.status?.trim();
    if (!fingerprint || !status || !ERROR_ISSUE_STATUS_VALUES.has(status)) {
      return result(false, "Estado no válido.");
    }
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    if (!prisma?.errorIssue) {
      return result(false, "Falta correr la migración de la bandeja de errores.");
    }

    const sample = await prisma.activityEvent.findFirst({
      where: { fingerprint },
      orderBy: { createdAt: "desc" },
      select: { summary: true },
    });
    if (!sample) return result(false, "Ese error ya no existe.");

    const userId = getSessionUserId(context.session);
    // `note` es texto no nulo en la base (vacío = sin nota).
    const note = args.note?.trim().slice(0, MAX_NOTE) ?? "";
    const data = {
      status,
      ...(args.note !== undefined ? { note } : {}),
      resolvedAt: status === ERROR_ISSUE_STATUS.OPEN ? null : new Date(),
      ...(userId ? { resolvedBy: { connect: { id: userId } } } : {}),
    };
    await prisma.errorIssue.upsert({
      where: { fingerprint },
      create: { fingerprint, ...data },
      update: data,
    });

    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_ERROR_ISSUE_UPDATED,
      companyId: null,
      summary: `${STATUS_LABELS[status]} el error "${sample.summary}"`,
      entityType: "ErrorIssue",
      entityId: fingerprint,
      metadata: { status, note: Boolean(note) },
    });

    return result(true, "Listo.");
  },
};

export default { typeDefs, definition, resolver };
