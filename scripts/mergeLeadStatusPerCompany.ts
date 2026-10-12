/**
 * Deja UN estatus de pipeline por (lead, empresa). Antes cada vendedor tenía su propia fila de
 * `TechStatusBusinessLead` y nadie veía los cambios de los demás; ahora el estatus es de la
 * empresa (ver models/Saas/Tech/StatusBusinessLead/README.md).
 *
 *   yarn leads:merge-status                        # solo reporta
 *   yarn leads:merge-status --apply                # aplica
 *   yarn leads:merge-status --company=<id> --apply
 *
 * Qué hace:
 * 1. Estatus sin empresa (los creaba la sincronización de admin): si el lead está en una sola
 *    empresa y esa empresa no tiene estatus, se le asigna; si no, se borra.
 * 2. Visibilidad: antes un vendedor veía un lead si tenía una fila de estatus suya; ahora solo si
 *    el lead lo tiene asignado (`TechBusinessLead.salesPerson`). A quien solo ve sus asignados se
 *    le asigna el lead para que no pierda ninguno.
 * 3. Duplicados: gana la etapa más avanzada (13 Perdido / 14 Descartado solo si no hay otra; en
 *    empate, la fila más nueva). Campos vacíos se llenan con los de las otras filas, las notas se
 *    juntan con el nombre de quien las escribió y el historial de etapas pasa a la ganadora.
 *
 * Se puede correr varias veces. Va ANTES de `yarn migrate` (el índice único falla si quedan
 * duplicados).
 */
import "../env";
import { PrismaClient } from "@prisma/client";
import { canSeeCompanyWideLeads } from "../utils/access/leadScopedFilter";

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

const CLOSED_LOST = new Set(["13 - Cerrado Perdido", "14 - Descartado"]);
const OPPORTUNITY_RANK: Record<string, number> = { Baja: 1, Media: 2, Alta: 3 };

/** "07 - Propuesta Enviada" → 7. Perdido / Descartado cuentan por debajo de cualquier etapa activa. */
function stageRank(status: string | null): number {
  if (!status || CLOSED_LOST.has(status)) return 0;
  const n = Number.parseInt(status.slice(0, 2), 10);
  return Number.isFinite(n) ? n : 0;
}

type StatusRow = {
  id: string;
  businessLeadId: string | null;
  saasCompanyId: string | null;
  salesPersonId: string | null;
  pipelineStatus: string | null;
  opportunityLevel: string | null;
  estimatedValue: number | null;
  productOffered: string;
  firstContactDate: Date | null;
  notes: string;
};

type UserInfo = {
  id: string;
  name: string;
  companyId: string | null;
  companyWide: boolean;
};

async function loadUsers(ids: string[]): Promise<Map<string, UserInfo>> {
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      lastName: true,
      companyId: true,
      permissions: true,
      roles: { select: { name: true } },
    },
  });
  return new Map(
    users.map((user) => [
      user.id,
      {
        id: user.id,
        name: [user.name, user.lastName].filter(Boolean).join(" ") || user.id,
        companyId: user.companyId,
        // Misma regla que el acceso de Keystone, con una sesión armada a partir del usuario.
        companyWide: canSeeCompanyWideLeads({
          data: { roles: user.roles, permissions: user.permissions },
        }),
      },
    ]),
  );
}

async function fixOrphans() {
  const orphans = await prisma.techStatusBusinessLead.findMany({
    where: { saasCompanyId: null },
    select: {
      id: true,
      businessLeadId: true,
      businessLead: { select: { saasCompany: { select: { id: true } } } },
    },
  });
  const toAssign: Array<{ id: string; companyId: string }> = [];
  const toDelete: string[] = [];
  const claimed = new Set<string>();

  for (const row of orphans) {
    const companies = row.businessLead?.saasCompany ?? [];
    const companyId = companies.length === 1 ? companies[0].id : null;
    if (!row.businessLeadId || !companyId || (onlyCompanyId && companyId !== onlyCompanyId)) {
      if (!onlyCompanyId) toDelete.push(row.id);
      continue;
    }
    const key = `${row.businessLeadId}|${companyId}`;
    const taken =
      claimed.has(key) ||
      (await prisma.techStatusBusinessLead.count({
        where: { businessLeadId: row.businessLeadId, saasCompanyId: companyId },
      })) > 0;
    if (taken) {
      toDelete.push(row.id);
    } else {
      claimed.add(key);
      toAssign.push({ id: row.id, companyId });
    }
  }

  console.log(
    `\n1) Estatus sin empresa: ${orphans.length} — ${toAssign.length} se asignan a su empresa, ${toDelete.length} se borran`,
  );
  if (!apply) return;
  for (const row of toAssign) {
    await prisma.techStatusBusinessLead.update({
      where: { id: row.id },
      data: { saasCompany: { connect: { id: row.companyId } } },
    });
  }
  if (toDelete.length) {
    await prisma.techStatusBusinessLead.deleteMany({ where: { id: { in: toDelete } } });
  }
}

async function keepSellerVisibility(users: Map<string, UserInfo>, rows: StatusRow[]) {
  const assigned = await prisma.techBusinessLead.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.businessLeadId).filter(Boolean) as string[])] } },
    select: { id: true, salesPerson: { select: { id: true } } },
  });
  const sellersOfLead = new Map(assigned.map((lead) => [lead.id, new Set(lead.salesPerson.map((u) => u.id))]));

  const missing = new Map<string, { leadId: string; userId: string }>();
  for (const row of rows) {
    if (!row.businessLeadId || !row.salesPersonId) continue;
    const user = users.get(row.salesPersonId);
    if (!user || user.companyWide || user.companyId !== row.saasCompanyId) continue;
    if (sellersOfLead.get(row.businessLeadId)?.has(user.id)) continue;
    missing.set(`${row.businessLeadId}|${user.id}`, { leadId: row.businessLeadId, userId: user.id });
  }

  console.log(`\n2) Vendedores que veían un lead solo por su fila de estatus: ${missing.size} se asignan al lead`);
  if (!apply) return;
  for (const { leadId, userId } of missing.values()) {
    await prisma.techBusinessLead.update({
      where: { id: leadId },
      data: { salesPerson: { connect: { id: userId } } },
    });
  }
}

function mergeGroup(group: StatusRow[], users: Map<string, UserInfo>) {
  const sorted = [...group].sort(
    (a, b) => stageRank(b.pipelineStatus) - stageRank(a.pipelineStatus) || (a.id < b.id ? 1 : -1),
  );
  const [winner, ...losers] = sorted;
  const all = [winner, ...losers];

  const values = all.map((r) => r.estimatedValue).filter((v): v is number => v != null);
  const dates = all.map((r) => r.firstContactDate).filter((d): d is Date => d != null);
  const opportunity = all
    .map((r) => r.opportunityLevel)
    .filter((o): o is string => !!o)
    .sort((a, b) => (OPPORTUNITY_RANK[b] ?? 0) - (OPPORTUNITY_RANK[a] ?? 0))[0];

  const extraNotes = losers
    .filter((r) => r.notes.trim())
    .map((r) => {
      const author = r.salesPersonId ? users.get(r.salesPersonId)?.name ?? "otro vendedor" : "sin vendedor";
      return `— Nota de ${author}:\n${r.notes.trim()}`;
    });

  return {
    winner,
    losers,
    data: {
      estimatedValue: values.length ? Math.max(...values) : null,
      firstContactDate: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
      opportunityLevel: opportunity ?? winner.opportunityLevel,
      productOffered: winner.productOffered || losers.find((r) => r.productOffered)?.productOffered || "",
      notes: [winner.notes.trim(), ...extraNotes].filter(Boolean).join("\n\n"),
    },
  };
}

async function main() {
  console.log(apply ? "Modo: APLICAR" : "Modo: solo reporte (usa --apply para escribir)");

  await fixOrphans();

  const rows: StatusRow[] = await prisma.techStatusBusinessLead.findMany({
    where: {
      saasCompanyId: onlyCompanyId ? onlyCompanyId : { not: null },
      businessLeadId: { not: null },
    },
    select: {
      id: true,
      businessLeadId: true,
      saasCompanyId: true,
      salesPersonId: true,
      pipelineStatus: true,
      opportunityLevel: true,
      estimatedValue: true,
      productOffered: true,
      firstContactDate: true,
      notes: true,
    },
  });
  const users = await loadUsers([...new Set(rows.map((r) => r.salesPersonId).filter(Boolean) as string[])]);

  await keepSellerVisibility(users, rows);

  const groups = new Map<string, StatusRow[]>();
  for (const row of rows) {
    const key = `${row.businessLeadId}|${row.saasCompanyId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const duplicated = [...groups.values()].filter((g) => g.length > 1);
  const merges = duplicated.map((group) => mergeGroup(group, users));
  const conflicts = merges.filter(
    (m) => new Set([m.winner, ...m.losers].map((r) => r.pipelineStatus)).size > 1,
  );
  const deleted = merges.reduce((sum, m) => sum + m.losers.length, 0);

  console.log(
    `\n3) Leads con más de un estatus en la misma empresa: ${duplicated.length} — se borran ${deleted} fila(s); ${conflicts.length} con etapas distintas`,
  );
  for (const m of conflicts.slice(0, 20)) {
    const stages = [m.winner, ...m.losers].map((r) => r.pipelineStatus ?? "sin etapa").join(" / ");
    console.log(`  - lead ${m.winner.businessLeadId} (empresa ${m.winner.saasCompanyId}): ${stages} → ${m.winner.pipelineStatus}`);
  }
  if (conflicts.length > 20) console.log(`  … y ${conflicts.length - 20} más`);

  if (!apply) {
    console.log("\nSolo reporte. Corre con --apply para aplicar.");
    return;
  }

  for (const m of merges) {
    const loserIds = m.losers.map((r) => r.id);
    // Prisma directo: sin hooks de Keystone (no hay sesión y no es un movimiento de etapa real).
    await prisma.$transaction([
      prisma.techStatusBusinessLead.update({ where: { id: m.winner.id }, data: m.data }),
      prisma.techLeadStageChange.updateMany({
        where: { statusId: { in: loserIds } },
        data: { statusId: m.winner.id },
      }),
      prisma.techStatusBusinessLead.deleteMany({ where: { id: { in: loserIds } } }),
    ]);
  }
  console.log(`\nListo: ${merges.length} lead(s) con un solo estatus por empresa.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
