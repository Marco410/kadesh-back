/**
 * Una vez (y se puede volver a correr): deja vacío `Animal.name` donde se guardó un texto de relleno
 * («Sin nombre», «Desconocido», «No sé»…). Desde ahora el nombre desconocido va vacío y la web y los
 * avisos lo describen («Perra café»). Misma regla que el `resolveInput` de `Animal`
 * (`isUnknownAnimalName` en utils/pet/animalName.ts). No toca el slug.
 *
 * Escribe con SQL directo para no disparar hooks ni mover fechas.
 *
 *   pnpm animals:backfill-unknown-names              # solo cuenta y muestra lo que cambiaría
 *   pnpm animals:backfill-unknown-names --apply      # lo guarda
 *   pnpm animals:backfill-unknown-names:prod --apply # contra producción (config/.env.prod)
 */
import "../env";
import { PrismaClient } from "@prisma/client";
import { isUnknownAnimalName } from "../utils/pet/animalName";

const apply = process.argv.includes("--apply");

const prisma = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connection_limit=2`,
    },
  },
});

async function main() {
  // Los textos de relleno son cortos: solo se revisan nombres de hasta 30 caracteres no vacíos.
  const rows = (await prisma.$queryRaw`
    SELECT id, name FROM "Animal" WHERE name <> '' AND length(name) <= 30
  `) as Array<{ id: string; name: string }>;
  const fixes = rows.filter((row) => isUnknownAnimalName(row.name));

  const byName = new Map<string, number>();
  for (const row of fixes) byName.set(row.name, (byName.get(row.name) ?? 0) + 1);
  console.log(`Animales con nombre de relleno: ${fixes.length}`);
  for (const [name, n] of [...byName].sort((a, b) => b[1] - a[1])) console.log(`  «${name}»: ${n}`);

  if (!apply) {
    console.log("Modo reporte. Corre con --apply para guardarlos.");
    return;
  }
  if (!fixes.length) return;
  const updated = await prisma.$executeRaw`
    UPDATE "Animal" SET name = '' WHERE id = ANY(${fixes.map((row) => row.id)}::text[])
  `;
  console.log(`Actualizados: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
