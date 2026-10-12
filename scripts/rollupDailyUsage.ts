/**
 * Rellena `SaasCompanyDailyUsage` para días pasados (el cron diario solo calcula ayer).
 *
 *   pnpm usage:rollup                                   # ayer
 *   pnpm usage:rollup --from=2026-09-01 --to=2026-10-10 # un rango (incluido)
 *
 * Recalcular es seguro: reemplaza las filas de cada día.
 */
import { getContext } from "@keystone-6/core/context";
import * as PrismaModule from "@prisma/client";
import config from "../keystone";
import {
  YMD_PATTERN,
  mxToday,
  rollupCompanyDailyUsage,
  shiftDay,
} from "../utils/usage/dailyUsageRollup";

function arg(name: string): string | null {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found ? found.split("=")[1]?.trim() || null : null;
}

async function main() {
  const yesterday = shiftDay(mxToday(), -1);
  const from = arg("from") ?? yesterday;
  const to = arg("to") ?? from;
  if (!YMD_PATTERN.test(from) || !YMD_PATTERN.test(to) || from > to) {
    throw new Error("Usa --from=AAAA-MM-DD y --to=AAAA-MM-DD (from <= to).");
  }
  const context = getContext(config, PrismaModule as any);
  for (let day = from; day <= to; day = shiftDay(day, 1)) {
    const result = await rollupCompanyDailyUsage(context, day);
    console.log(`${result.day}: ${result.companies} empresas`);
  }
  await (context.prisma as any).$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
