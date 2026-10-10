/**
 * Repara leads "fantasma": la empresa tiene su status (Detectado) y se le cobró, pero el
 * lead nunca quedó ligado a ella (el hook de tenant quitaba el connect; ver
 * models/Saas/README.md, 2026-10-10). No aparecían en Clientes y el dashboard
 * los contaba como "Sin dato".
 *
 *   pnpm leads:repair-unlinked                       # solo reporta
 *   pnpm leads:repair-unlinked --apply               # liga los leads a su empresa
 *   pnpm leads:repair-unlinked --company=<id> --apply
 *
 * Solo agrega vínculos (connect) que ya respalda un status de esa empresa. No toca créditos:
 * si hubo cobro doble, se devuelve a mano desde Operaciones (Ajustar plan → créditos extra).
 */
import "../env";
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const companyArg = process.argv.find((arg) => arg.startsWith("--company="));
const onlyCompanyId = companyArg?.split("=")[1]?.trim() || null;

const prisma = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}`,
    },
  },
});

async function main() {
  // Status de empresa X cuyo lead no está ligado a X.
  const rows = await prisma.techStatusBusinessLead.findMany({
    where: {
      saasCompanyId: onlyCompanyId ? onlyCompanyId : { not: null },
      businessLeadId: { not: null },
    },
    select: {
      saasCompanyId: true,
      businessLeadId: true,
      businessLead: { select: { businessName: true, saasCompany: { select: { id: true } } } },
      saasCompany: { select: { name: true } },
    },
  });

  const unlinked = rows.filter(
    (row) =>
      row.saasCompanyId &&
      row.businessLead &&
      !row.businessLead.saasCompany.some((c) => c.id === row.saasCompanyId),
  );

  const byCompany = new Map<string, { name: string; leads: Array<{ id: string; name: string }> }>();
  for (const row of unlinked) {
    const key = row.saasCompanyId as string;
    const entry = byCompany.get(key) ?? { name: row.saasCompany?.name ?? key, leads: [] };
    entry.leads.push({ id: row.businessLeadId as string, name: row.businessLead?.businessName ?? "" });
    byCompany.set(key, entry);
  }

  if (byCompany.size === 0) {
    console.log("No hay leads sin ligar. Nada que reparar.");
    return;
  }

  for (const [companyId, entry] of byCompany) {
    console.log(`\n${entry.name} (${companyId}): ${entry.leads.length} lead(s) sin ligar`);
    for (const lead of entry.leads.slice(0, 5)) console.log(`  - ${lead.name} (${lead.id})`);
    if (entry.leads.length > 5) console.log(`  … y ${entry.leads.length - 5} más`);
  }

  if (!apply) {
    console.log("\nSolo reporte. Corre con --apply para ligarlos.");
    return;
  }

  let fixed = 0;
  for (const [companyId, entry] of byCompany) {
    for (const lead of entry.leads) {
      // Prisma directo: sin sesión, el hook de tenant de Keystone volvería a quitar el connect.
      await prisma.techBusinessLead.update({
        where: { id: lead.id },
        data: { saasCompany: { connect: { id: companyId } } },
      });
      fixed += 1;
    }
  }
  console.log(`\nListo: ${fixed} lead(s) ligados a su empresa.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
