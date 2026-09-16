/* eslint-disable no-console */
/**
 * Precarga indicadores BIE curados a nivel estatal (01–32) + nacional (00).
 *
 *   pnpm inegi:import:indicadores
 *   pnpm inegi:import:indicadores -- 09
 */
import { getContext } from "@keystone-6/core/context";
import * as PrismaModule from "@prisma/client";
import config from "./keystone";
import {
  INEGI_INDICATOR_CATALOG,
  MEXICO_STATE_CODES,
  fetchAndCacheIndicator,
  throttle,
} from "./utils/inegi";

async function main() {
  if (!process.env.INEGI_INDICADORES_TOKEN?.trim()) {
    console.error("INEGI_INDICADORES_TOKEN no configurada");
    process.exit(1);
  }

  const onlyState = process.argv.slice(2).find((arg) => /^\d{2}$/.test(arg));
  const areas = onlyState
    ? [onlyState]
    : ["00", ...MEXICO_STATE_CODES];

  const context = getContext(config, PrismaModule);
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const area of areas) {
    for (const indicator of INEGI_INDICATOR_CATALOG) {
      try {
        await throttle();
        const result = await fetchAndCacheIndicator(
          context,
          indicator.id,
          area,
          true,
        );
        created += result.created;
        updated += result.updated;
        console.log(
          `${area} ${indicator.id} (${indicator.name}): +${result.created} ~${result.updated}`,
        );
      } catch (err) {
        errors += 1;
        console.warn(
          `${area} ${indicator.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  console.log(
    `Listo indicadores: ${created} nuevos, ${updated} actualizados, ${errors} errores`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
