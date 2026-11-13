/**
 * Una vez (y se puede volver a correr): llena `Animal.outcome` y `Animal.closedAt` en los casos que
 * ya se cerraron con una bitácora antes de que existieran esos campos.
 *
 * Mismas reglas que `syncAnimalOutcomeFromLog` (`models/Pet/Animal/Animal.outcome.ts`):
 * - Solo animales sin desenlace, no unidos a otro (`duplicateOf`), cuyo último registro es final
 *   (`in_family` → reunited, `adopted` → adopted, `closed` → closed_unresolved).
 * - Y que antes tuvieron un caso abierto (`lost`, `found`, `rescued`, `abandoned`, `in_adoption`):
 *   un animal que nace «En familia» no es un reencuentro.
 * - `closedAt` = fecha del último registro. `helpedByKadesh` queda vacío (nadie respondió).
 *
 * Escribe con SQL directo, en una sola sentencia.
 *
 *   pnpm animals:backfill-outcomes              # solo cuenta y muestra lo que cambiaría
 *   pnpm animals:backfill-outcomes --apply      # lo guarda
 *   pnpm animals:backfill-outcomes:prod --apply # contra producción (config/.env.prod)
 */
import "../env";
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");

const prisma = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connection_limit=2`,
    },
  },
});

/** Candidatos: último registro de cada animal sin desenlace y si tuvo un caso abierto antes. */
const CANDIDATES_SQL = `
  WITH latest AS (
    SELECT DISTINCT ON (l."animal") l."animal" AS id, l.status, COALESCE(l."date_status", l."createdAt") AS closed_at
    FROM "AnimalLog" l
    JOIN "Animal" a ON a.id = l."animal"
    WHERE a.outcome IS NULL AND a."duplicateOf" IS NULL
    ORDER BY l."animal", l."date_status" DESC NULLS LAST, l."createdAt" DESC NULLS LAST
  )
  SELECT latest.id,
         CASE latest.status
           WHEN 'in_family' THEN 'reunited'
           WHEN 'adopted' THEN 'adopted'
           WHEN 'closed' THEN 'closed_unresolved'
         END AS outcome,
         latest.closed_at
  FROM latest
  WHERE latest.status IN ('in_family', 'adopted', 'closed')
    AND EXISTS (
      SELECT 1 FROM "AnimalLog" o
      WHERE o."animal" = latest.id
        AND o.status IN ('lost', 'found', 'rescued', 'abandoned', 'in_adoption')
    )
`;

async function main() {
  const rows = (await prisma.$queryRawUnsafe(CANDIDATES_SQL)) as Array<{
    id: string;
    outcome: string;
    closed_at: Date | null;
  }>;

  const byOutcome = new Map<string, number>();
  for (const row of rows) byOutcome.set(row.outcome, (byOutcome.get(row.outcome) ?? 0) + 1);
  console.log(`Casos cerrados sin desenlace: ${rows.length}`);
  for (const [outcome, n] of byOutcome) console.log(`  ${outcome}: ${n}`);

  if (!apply) {
    console.log("Modo reporte. Corre con --apply para guardarlos.");
    return;
  }
  const updated = await prisma.$executeRawUnsafe(`
    UPDATE "Animal" a
    SET outcome = c.outcome, "closedAt" = COALESCE(c.closed_at, NOW())
    FROM (${CANDIDATES_SQL}) c
    WHERE a.id = c.id AND a.outcome IS NULL
  `);
  console.log(`Actualizados: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
