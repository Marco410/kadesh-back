import { KeystoneContext } from "@keystone-6/core/types";
import { CalendarEventSource, DEFAULT_EVENT_DURATION_MINUTES } from "./constants";

/**
 * Convierte Actividades, Tareas de seguimiento, Tareas y Propuestas NUEVAS en
 * TechCalendarEvent (los registros previos no se tocan: solo se sincroniza el evento si
 * ya existe uno enlazado). El push a Google lo hace el hook del propio TechCalendarEvent.
 */

type CrmListKey =
  | "TechSalesActivity"
  | "TechFollowUpTask"
  | "TechTask"
  | "TechProposal";

type EventDraft = {
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
};

type CrmConfig = {
  sourceType: CalendarEventSource;
  /** Relación en TechCalendarEvent hacia el registro CRM. */
  relationField: "salesActivity" | "followUpTask" | "task" | "proposal";
  /** Campo con el usuario dueño del evento. */
  ownerField: "assignedSeller" | "responsible";
  query: string;
  build: (item: any) => EventDraft | null;
};

const COMMON_QUERY =
  "workspace { id company { id } } businessLead { businessName saasCompany { id } } createdBy { id company { id } }";

/** `calendarDay` (YYYY-MM-DD) → timestamp 00:00Z (convención de eventos allDay). */
function dayToIso(day: string | null | undefined): string | null {
  return day ? `${day}T00:00:00.000Z` : null;
}

function withLead(base: string, item: any): string {
  const lead = item.businessLead?.businessName;
  return lead ? `${base} — ${lead}` : base;
}

const CONFIGS: Record<CrmListKey, CrmConfig> = {
  TechSalesActivity: {
    sourceType: CalendarEventSource.SALES_ACTIVITY,
    relationField: "salesActivity",
    ownerField: "assignedSeller",
    query: `id title type activityDate comments assignedSeller { id company { id } } ${COMMON_QUERY}`,
    build: (item) => {
      if (!item.activityDate) return null;
      const start = new Date(item.activityDate);
      return {
        title: withLead(item.title || item.type || "Actividad", item),
        description: item.comments ?? null,
        startAt: start.toISOString(),
        endAt: new Date(
          start.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60_000,
        ).toISOString(),
        allDay: false,
      };
    },
  },
  TechFollowUpTask: {
    sourceType: CalendarEventSource.FOLLOW_UP_TASK,
    relationField: "followUpTask",
    ownerField: "assignedSeller",
    query: `id scheduledDate notes assignedSeller { id company { id } } ${COMMON_QUERY}`,
    build: (item) => {
      const startAt = dayToIso(item.scheduledDate);
      if (!startAt) return null;
      return {
        title: withLead("Seguimiento", item),
        description: item.notes ?? null,
        startAt,
        endAt: null,
        allDay: true,
      };
    },
  },
  TechTask: {
    sourceType: CalendarEventSource.TASK,
    relationField: "task",
    ownerField: "responsible",
    query: `id title startDate dueDate comments responsible { id company { id } } ${COMMON_QUERY}`,
    build: (item) => {
      if (!item.startDate) return null;
      const start = new Date(item.startDate);
      const due = item.dueDate ? new Date(item.dueDate) : null;
      return {
        title: withLead(item.title || "Tarea", item),
        description: item.comments ?? null,
        startAt: start.toISOString(),
        // Solo si el fin es válido; si no, el push usa la duración por defecto.
        endAt: due && due.getTime() >= start.getTime() ? due.toISOString() : null,
        allDay: false,
      };
    },
  },
  TechProposal: {
    sourceType: CalendarEventSource.PROPOSAL,
    relationField: "proposal",
    ownerField: "assignedSeller",
    query: `id sentDate product notes assignedSeller { id company { id } } ${COMMON_QUERY}`,
    build: (item) => {
      const startAt = dayToIso(item.sentDate);
      if (!startAt) return null;
      return {
        title: withLead(`Propuesta${item.product ? `: ${item.product}` : ""}`, item),
        description: item.notes ?? null,
        startAt,
        endAt: null,
        allDay: true,
      };
    },
  },
};

function isCrmListKey(listKey: string): listKey is CrmListKey {
  return listKey in CONFIGS;
}

function resolveCompanyId(item: any, ownerField: string): string | null {
  return (
    item.workspace?.company?.id ??
    item.businessLead?.saasCompany?.[0]?.id ??
    item[ownerField]?.company?.id ??
    item.createdBy?.company?.id ??
    null
  );
}

function sameInstant(a?: string | null, b?: string | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

async function findLinkedEvent(
  context: KeystoneContext,
  cfg: CrmConfig,
  itemId: string,
) {
  const [existing] = (await context.sudo().query.TechCalendarEvent.findMany({
    where: { [cfg.relationField]: { id: { equals: itemId } } },
    take: 1,
    query: "id title description startAt endAt allDay",
  })) as {
    id: string;
    title: string;
    description?: string | null;
    startAt: string;
    endAt?: string | null;
    allDay: boolean;
  }[];
  return existing ?? null;
}

async function syncCalendarEventFromCrm(
  context: KeystoneContext,
  listKey: CrmListKey,
  operation: "create" | "update",
  itemId: string,
): Promise<void> {
  const cfg = CONFIGS[listKey];
  const item = await context.sudo().query[listKey].findOne({
    where: { id: itemId },
    query: cfg.query,
  });
  if (!item) return;

  const draft = cfg.build(item);
  const existing = await findLinkedEvent(context, cfg, itemId);

  if (!existing) {
    // Solo registros nuevos: una edición de un registro viejo no crea evento.
    if (operation !== "create" || !draft) return;

    const companyId = resolveCompanyId(item, cfg.ownerField);
    const ownerId =
      (item as any)[cfg.ownerField]?.id ??
      (item as any).createdBy?.id ??
      (context.session as any)?.data?.id ??
      null;
    if (!companyId || !ownerId) return;

    await context.sudo().query.TechCalendarEvent.createOne({
      data: {
        ...draft,
        sourceType: cfg.sourceType,
        [cfg.relationField]: { connect: { id: itemId } },
        createdBy: { connect: { id: ownerId } },
        company: { connect: { id: companyId } },
        ...((item as any).workspace?.id && {
          workspace: { connect: { id: (item as any).workspace.id } },
        }),
      },
    });
    return;
  }

  if (!draft) return;
  const unchanged =
    existing.title === draft.title &&
    (existing.description ?? null) === draft.description &&
    existing.allDay === draft.allDay &&
    sameInstant(existing.startAt, draft.startAt) &&
    sameInstant(existing.endAt, draft.endAt);
  if (unchanged) return;

  await context.sudo().query.TechCalendarEvent.updateOne({
    where: { id: existing.id },
    data: draft,
  });
}

async function deleteLinkedCalendarEvent(
  context: KeystoneContext,
  listKey: CrmListKey,
  itemId: string,
): Promise<void> {
  const existing = await findLinkedEvent(context, CONFIGS[listKey], itemId);
  if (!existing) return;
  // El beforeOperation(delete) del evento borra antes las copias en Google.
  await context.sudo().query.TechCalendarEvent.deleteOne({ where: { id: existing.id } });
}

/**
 * Hooks de lista para mezclar en los modelos CRM. Nunca lanzan: el CRM no debe fallar
 * por un problema de calendario.
 */
export const crmCalendarHooks = {
  beforeOperation: async ({ operation, item, context, listKey }: any) => {
    if (operation !== "delete" || !item?.id || !isCrmListKey(listKey)) return;
    try {
      await deleteLinkedCalendarEvent(context, listKey, item.id);
    } catch (err) {
      console.error(`Error borrando evento de calendario (${listKey}):`, err);
    }
  },
  afterOperation: async ({ operation, item, context, listKey }: any) => {
    if (operation === "delete" || !item?.id || !isCrmListKey(listKey)) return;
    try {
      await syncCalendarEventFromCrm(context, listKey, operation, item.id);
    } catch (err) {
      console.error(`Error sincronizando evento de calendario (${listKey}):`, err);
    }
  },
};
