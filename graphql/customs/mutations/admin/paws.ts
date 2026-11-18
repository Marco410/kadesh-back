import type { KeystoneContext } from "@keystone-6/core/types";
import { ADMIN_ADJUST_MAX } from "../../../../models/Pet/Paws/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";
import { adjustPaws } from "../../../../utils/pet/paws";
import { invalidatePawLeaderboard } from "../../queries/pawLeaderboard";

/**
 * Operaciones: manual correction of someone's paw points (give a gift, take back farmed points).
 * Platform admin only. It writes an `admin_adjust` row in the ledger with the reason and the admin,
 * and an activity event. `AdminOpsActionResult` is declared in `companyOps.ts`.
 */
const REASON_MIN = 5;
const REASON_MAX = 300;

const typeDefs = ``;

const definition = `
  adminAdjustPaws(userId: ID!, amount: Int!, reason: String!): AdminOpsActionResult!
`;

const resolver = {
  adminAdjustPaws: async (
    _root: unknown,
    { userId, amount, reason }: { userId: string; amount: number; reason: string },
    context: KeystoneContext,
  ) => {
    const adminId = getSessionUserId(context.session as any);
    if (!adminId || !isPlatformAdmin(context.session as any)) {
      return { success: false, message: "Solo un administrador de Kadesh puede hacer esto." };
    }
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > ADMIN_ADJUST_MAX) {
      return { success: false, message: `La cantidad debe ser un entero distinto de 0, de hasta ${ADMIN_ADJUST_MAX}.` };
    }
    const cleanReason = (reason ?? "").replace(/\s+/g, " ").trim().slice(0, REASON_MAX);
    if (cleanReason.length < REASON_MIN) {
      return { success: false, message: "Escribe el motivo del ajuste: queda en el historial." };
    }

    try {
      const result = await adjustPaws(context, { userId, amount, reason: cleanReason, adminId });
      if (!result) return { success: false, message: "No encontramos a esa persona." };
      invalidatePawLeaderboard();
      void logActivity(context, {
        type: "paws.adjusted",
        summary: `Ajustó ${amount > 0 ? "+" : ""}${amount} huellitas: ${cleanReason}`,
        entityType: "User",
        entityId: userId,
        metadata: { amount, balance: result.balance, lifetimeEarned: result.lifetimeEarned },
      });
      return {
        success: true,
        message: `Listo: ${amount > 0 ? "+" : ""}${amount} huellitas. Saldo: ${result.balance}.`,
      };
    } catch (error) {
      console.error("[adminAdjustPaws]", error);
      return { success: false, message: "No pudimos guardar el ajuste. Intenta de nuevo." };
    }
  },
};

export default { typeDefs, definition, resolver };
