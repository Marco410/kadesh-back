/**
 * Una vez: llena `TechBusinessLead.businessNameSearch` en los leads que ya existían.
 *
 * El campo es `businessName` en minúsculas y sin acentos, para buscar con `contains` sin
 * distinguir acentos ni mayúsculas. Los leads nuevos lo reciben del hook del list; los
 * anteriores a la migración quedaron con el campo vacío. Se puede volver a correr: solo toca
 * las filas cuyo valor no coincide con el que da `normalizeSearchText`.
 *
 * Escribe con SQL directo para no mover `updatedAt` de todos los leads.
 *
 *   pnpm leads:backfill-search-names              # solo cuenta y muestra lo que cambiaría
 *   pnpm leads:backfill-search-names --apply      # lo guarda
 *   pnpm leads:backfill-search-names:prod --apply # contra producción (config/.env.prod)
 */
import "../env";
import { PrismaClient } from "@prisma/client";
import { normalizeSearchText } from "../utils/helpers/normalizeSearchText";

const apply = process.argv.includes("--apply");

const prisma = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connection_limit=2`,
    },
  },
});

async function main() {
  const leads = (await (prisma as any).techBusinessLead.findMany({
    select: { id: true, businessName: true, businessNameSearch: true },
  })) as Array<{ id: string; businessName: string; businessNameSearch: string }>;

  const fixes = leads
    .map((lead) => ({ ...lead, next: normalizeSearchText(lead.businessName) }))
    .filter((lead) => lead.next !== lead.businessNameSearch);

  console.log(`Leads: ${leads.length} (por actualizar: ${fixes.length})`);
  for (const lead of fixes.slice(0, 20)) console.log(`  "${lead.businessName}" → "${lead.next}"`);
  if (fixes.length > 20) console.log(`  … y ${fixes.length - 20} más`);

  if (!apply) {
    console.log("Modo reporte. Corre con --apply para guardarlos.");
    return;
  }
  let updated = 0;
  for (const lead of fixes) {
    await prisma.$executeRaw`UPDATE "TechBusinessLead" SET "businessNameSearch" = ${lead.next} WHERE "id" = ${lead.id}`;
    updated += 1;
  }
  console.log(`Actualizados: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
