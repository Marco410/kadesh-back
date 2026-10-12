import type { KeystoneContext } from "@keystone-6/core/types";
import {
  YMD_PATTERN,
  mxToday,
  rollupDailyUsageRange,
  shiftDay,
} from "../../../utils/usage/dailyUsageRollup";

const typeDefs = `
  type RollupDailyUsageDay {
    day: String!
    companies: Int!
  }

  type RollupDailyUsageResult {
    success: Boolean!
    message: String!
    days: [RollupDailyUsageDay!]!
  }

  type Mutation {
    rollupDailyUsage(secret: String!, day: String, days: Int): RollupDailyUsageResult!
  }
`;

const definition = `
  rollupDailyUsage(secret: String!, day: String, days: Int): RollupDailyUsageResult!
`;

const MAX_DAYS = 62;

const resolver = {
  /**
   * Arma `SaasCompanyDailyUsage` (ver utils/usage/dailyUsageRollup.ts). La llama un cron diario
   * (.github/workflows/rollup-daily-usage.yml) con `CRON_SECRET`, igual que publishScheduledPosts.
   * Sin `day`, calcula ayer (CDMX). `days` recalcula hacia atrás (p. ej. 3 por si un día falló).
   */
  rollupDailyUsage: async (
    _root: unknown,
    { secret, day, days }: { secret: string; day?: string | null; days?: number | null },
    context: KeystoneContext,
  ) => {
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected || secret !== expected) {
      return { success: false, message: "No autorizado.", days: [] };
    }
    const lastDay = day?.trim() || shiftDay(mxToday(), -1);
    if (!YMD_PATTERN.test(lastDay)) {
      return { success: false, message: "El día debe tener el formato AAAA-MM-DD.", days: [] };
    }
    const count = Math.min(MAX_DAYS, Math.max(1, Math.floor(Number(days) || 1)));
    try {
      const results = await rollupDailyUsageRange(context, lastDay, count);
      return {
        success: true,
        message: `Resumen listo: ${results.length} día${results.length === 1 ? "" : "s"}.`,
        days: results,
      };
    } catch (error) {
      console.error("[rollupDailyUsage]", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "No se pudo calcular el resumen.",
        days: [],
      };
    }
  },
};

export default { typeDefs, definition, resolver };
