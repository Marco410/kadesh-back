/**
 * Una vez (y se puede volver a correr): llena `Animal.lastActivityAt` con la fecha del último
 * registro de cada animal (o su `createdAt` si no tiene). Hay que correrlo justo después de la
 * migración: al agregar la columna, Postgres pone la fecha de ese momento a todos los animales y el
 * seguimiento (`sendAnimalFollowUps`) los vería como recién actualizados.
 *
 * Muestra además lo que haría la primera corrida del cron con las fechas corregidas, para que no
 * sorprenda: cuántos recordatorios salen y cuántos casos sin dueño dejan el mapa.
 *
 *   pnpm animals:backfill-activity              # solo cuenta y muestra lo que cambiaría
 *   pnpm animals:backfill-activity --apply      # lo guarda
 *   pnpm animals:backfill-activity:prod --apply # contra producción (config/.env.prod)
 */
import "../env";
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const automation = process.env.PET_AUTOMATION_USER_ID?.trim() || "__sin_automatizacion__";

const prisma = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connection_limit=2`,
    },
  },
});

/** Fecha real de la última actividad de cada animal. */
const ACTIVITY_SQL = `
  SELECT a.id, COALESCE(MAX(l."createdAt"), a."createdAt", NOW()) AS last_activity
  FROM "Animal" a
  LEFT JOIN "AnimalLog" l ON l."animal" = a.id
  GROUP BY a.id
`;

/** Casos abiertos (último registro abierto, sin desenlace ni repetido) según la actividad real. */
const OPEN_CASES_SQL = `
  SELECT act.last_activity, (a."user" IS NULL OR a."user" = $1) AS unowned
  FROM (${ACTIVITY_SQL}) act
  JOIN "Animal" a ON a.id = act.id
  JOIN LATERAL (
    SELECT l.status FROM "AnimalLog" l
    WHERE l."animal" = a.id
    ORDER BY l."date_status" DESC NULLS LAST, l."createdAt" DESC NULLS LAST
    LIMIT 1
  ) last ON true
  WHERE a.outcome IS NULL AND a."duplicateOf" IS NULL AND a."inactiveAt" IS NULL
    AND last.status IN ('lost', 'found', 'rescued', 'abandoned', 'in_adoption')
`;

async function main() {
  const stale = (await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS n
    FROM (${ACTIVITY_SQL}) act JOIN "Animal" a ON a.id = act.id
    WHERE a."lastActivityAt" IS DISTINCT FROM act.last_activity
  `)) as Array<{ n: number }>;
  console.log(`Animales con lastActivityAt por corregir: ${stale[0]?.n ?? 0}`);

  const open = (await prisma.$queryRawUnsafe(OPEN_CASES_SQL, automation)) as Array<{
    last_activity: Date;
    unowned: boolean;
  }>;
  const days = (date: Date) => (Date.now() - new Date(date).getTime()) / 86_400_000;
  const owned = open.filter((row) => !row.unowned);
  const unowned = open.filter((row) => row.unowned);
  console.log(`Casos abiertos: ${open.length} (con dueño: ${owned.length}, sin dueño/automatización: ${unowned.length})`);
  console.log(`  Primer recordatorio en la próxima corrida (≥7 días, con dueño): ${owned.filter((r) => days(r.last_activity) >= 7).length} (tope 200 por día)`);
  console.log(`  Salen del mapa en la próxima corrida (sin dueño, ≥30 días): ${unowned.filter((r) => days(r.last_activity) >= 30).length} (tope 500 por día)`);

  if (!apply) {
    console.log("Modo reporte. Corre con --apply para guardarlos.");
    return;
  }
  const updated = await prisma.$executeRawUnsafe(`
    UPDATE "Animal" a
    SET "lastActivityAt" = act.last_activity
    FROM (${ACTIVITY_SQL}) act
    WHERE a.id = act.id AND a."lastActivityAt" IS DISTINCT FROM act.last_activity
  `);
  console.log(`Actualizados: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
