/**
 * Retención de `ActivityEvent`: borra los eventos con más de 13 meses
 * (`ACTIVITY_RETENTION_MONTHS`). Un año completo alcanza para comparar contra el mismo mes
 * del año anterior; más allá solo crece la tabla y la exposición de datos personales (IP).
 *
 *   pnpm activity:prune            # solo cuenta lo que borraría
 *   pnpm activity:prune --apply    # borra
 *
 * `UserActivityDay` (minutos por día) no se borra: es chica y sirve para cohortes.
 * Correrlo una vez al mes (cron del hosting) basta.
 */
import "../env";
import { PrismaClient } from "@prisma/client";
import { ACTIVITY_RETENTION_MONTHS } from "../models/ActivityEvent/constants";

const apply = process.argv.includes("--apply");

const prisma = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}`,
    },
  },
});

async function main() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - ACTIVITY_RETENTION_MONTHS);
  const where = { createdAt: { lt: cutoff } };

  const count = await (prisma as any).activityEvent.count({ where });
  console.log(
    `Eventos anteriores a ${cutoff.toISOString().slice(0, 10)} (${ACTIVITY_RETENTION_MONTHS} meses): ${count}`,
  );
  if (!apply) {
    console.log("Modo reporte. Corre con --apply para borrarlos.");
    return;
  }
  if (count === 0) return;
  const { count: deleted } = await (prisma as any).activityEvent.deleteMany({ where });
  console.log(`Borrados: ${deleted}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
