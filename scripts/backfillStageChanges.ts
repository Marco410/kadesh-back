/**
 * Recupera el historial de etapas (`TechLeadStageChange`) a partir de los eventos
 * `lead.status_changed` de `ActivityEvent` (se guardan desde la fase 2). Lo de antes no existe
 * en ningún lado: no se puede reconstruir.
 *
 *   pnpm pipeline:backfill            # solo cuenta lo que agregaría
 *   pnpm pipeline:backfill --apply    # lo agrega
 *
 * Se puede correr varias veces: salta los cambios que ya están (mismo estatus y etapa, con menos de
 * un minuto de diferencia).
 */
import "../env";
import { PrismaClient } from "@prisma/client";
import { ACTIVITY_EVENT } from "../models/ActivityEvent/constants";

const apply = process.argv.includes("--apply");
const SAME_CHANGE_MS = 60_000;

const prisma: any = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}`,
    },
  },
});

type Metadata = { from?: string | null; to?: string | null; statusId?: string | null };

async function main() {
  const events: Array<{
    companyId: string | null;
    actorId: string | null;
    entityId: string | null;
    metadata: Metadata | null;
    source: string | null;
    createdAt: Date | null;
  }> = await prisma.activityEvent.findMany({
    where: { type: ACTIVITY_EVENT.LEAD_STATUS_CHANGED },
    orderBy: { createdAt: "asc" },
    select: { companyId: true, actorId: true, entityId: true, metadata: true, source: true, createdAt: true },
  });

  const existing: Array<{ statusId: string; toStatus: string; changedAt: Date }> =
    await prisma.techLeadStageChange.findMany({ select: { statusId: true, toStatus: true, changedAt: true } });
  // Desde que existe el hook, cada cambio queda en las dos tablas con milisegundos de diferencia:
  // mismo estatus y etapa con menos de un minuto entre sí es el mismo cambio.
  const seen = new Map<string, number[]>();
  const remember = (key: string, at: Date) => seen.set(key, [...(seen.get(key) ?? []), at.getTime()]);
  const isKnown = (key: string, at: Date) =>
    (seen.get(key) ?? []).some((time) => Math.abs(time - at.getTime()) < SAME_CHANGE_MS);
  for (const row of existing) remember(`${row.statusId}|${row.toStatus}`, row.changedAt);
  const leadIds = new Set(
    (await prisma.techBusinessLead.findMany({ select: { id: true } })).map((row: { id: string }) => row.id),
  );
  const companyIds = new Set(
    (await prisma.saasCompany.findMany({ select: { id: true } })).map((row: { id: string }) => row.id),
  );

  const rows = [];
  for (const event of events) {
    const meta = event.metadata ?? {};
    if (!meta.statusId || !meta.to || !event.createdAt) continue;
    const key = `${meta.statusId}|${meta.to}`;
    if (isKnown(key, event.createdAt)) continue;
    remember(key, event.createdAt);
    rows.push({
      statusId: meta.statusId,
      companyId: event.companyId && companyIds.has(event.companyId) ? event.companyId : null,
      businessLeadId: event.entityId && leadIds.has(event.entityId) ? event.entityId : null,
      fromStatus: meta.from ?? null,
      toStatus: meta.to,
      changedById: event.actorId,
      source: "backfill",
      changedAt: event.createdAt,
    });
  }

  console.log(`Eventos de cambio de etapa: ${events.length}. Faltan en el historial: ${rows.length}.`);
  if (!apply) {
    console.log("Modo reporte. Corre con --apply para agregarlos.");
    return;
  }
  if (rows.length === 0) return;
  const { count } = await prisma.techLeadStageChange.createMany({ data: rows });
  console.log(`Agregados: ${count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
