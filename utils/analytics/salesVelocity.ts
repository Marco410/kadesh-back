import { PIPELINE_STATUS } from "../../models/Saas/Tech/crm/constants";

/**
 * Velocidad comercial: qué tan rápido se mueven los leads, a partir del historial de etapas
 * (`TechLeadStageChange`), las actividades y los WhatsApp. Lo usan Operaciones
 * (`adminSalesVelocity`) y la Analítica que ve cada cliente (`companyAnalytics`): la misma regla
 * para los dos.
 *
 * - Avanzar = pasar a una etapa más adelante. "Sin respuesta" cuenta al nivel de "Contactado".
 * - Ganado = Propuesta Aceptada o Cerrado Ganado. Perdido = Rechazada, Cerrado Perdido o Descartado.
 * - El historial existe desde que se empezó a guardar: lo anterior no se puede reconstruir, por eso
 *   se devuelve `dataSince` y el ciclo de venta solo cuenta leads que vimos entrar al pipeline.
 * - El vendedor de un trato es el que tiene asignado hoy el lead en esa empresa
 *   (`TechBusinessLead.salesPerson`; el estatus es de la empresa, no de un vendedor).
 */

type StatusSellers = {
  id: string;
  saasCompanyId: string | null;
  businessLeadId: string | null;
  businessLead: { salesPerson: Array<{ id: string; companyId: string | null }> } | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const P = PIPELINE_STATUS;
const RANK: Record<string, number> = {
  [P.DETECTADO]: 1,
  [P.SELECCIONADO]: 2,
  [P.CONTACTADO]: 3,
  [P.SIN_RESPUESTA]: 3,
  [P.INTERESADO]: 4,
  [P.CREANDO_PROYECTO_PROPUESTA]: 5,
  [P.PROPUESTA_ENVIADA]: 6,
  [P.SEGUIMIENTO]: 6,
  [P.EN_NEGOCIACION]: 7,
  [P.PROPUESTA_ACEPTADA]: 8,
  [P.CERRADO_GANADO]: 9,
};
const WON = new Set<string>([P.PROPUESTA_ACEPTADA, P.CERRADO_GANADO]);
const LOST = new Set<string>([P.PROPUESTA_RECHAZADA, P.CERRADO_PERDIDO, P.DESCARTADO]);
/** Desde "Contactado" ya hubo contacto (también si lo descartaron después de hablar). */
const CONTACT_RANK = 3;
export const STALLED_DAYS = 14;
/** Para saber cuánto duró una etapa que empezó antes del periodo. */
const LOOKBACK_DAYS = 180;
const WHATSAPP_REPLY_WINDOW_MS = 7 * DAY_MS;

export type VelocityGroupStats = {
  entered: number;
  contacted: number;
  contactedWithin2Days: number;
  won: number;
  lost: number;
  winRate: number | null;
  medianCycleDays: number | null;
  medianFirstContactHours: number | null;
  stalled: number;
};

export type StalledDeal = {
  statusId: string;
  companyId: string | null;
  businessLeadId: string | null;
  salesPersonId: string | null;
  stage: string;
  since: Date;
  days: number;
};

export type SalesVelocity = {
  days: number;
  dataSince: Date | null;
  stages: Array<{
    stage: string;
    entered: number;
    advanced: number;
    lost: number;
    medianDays: number | null;
    stalled: number;
  }>;
  won: number;
  lost: number;
  winRate: number | null;
  wonValue: number;
  medianCycleDays: number | null;
  cycleSample: number;
  newLeads: number;
  contacted: number;
  contactedWithin2Days: number;
  medianFirstContactHours: number | null;
  stalled: number;
  whatsappInbound: number;
  whatsappAnswered: number;
  whatsappAnsweredWithin1h: number;
  whatsappMedianResponseMinutes: number | null;
  whatsappConversations: number;
  whatsappReplied: number;
  /** Por empresa (llave = companyId). */
  byCompany: Map<string, VelocityGroupStats>;
  /** Por vendedor asignado (llave = userId o "" sin vendedor). Solo si se pide `bySeller`. */
  bySeller: Map<string, VelocityGroupStats>;
  /** Tratos estancados, del más viejo al más nuevo. */
  stalledDeals: StalledDeal[];
};

export type SalesVelocityOptions = {
  days: number;
  /** Filtro de Prisma para la empresa: un id o `{ notIn: [...] }`. */
  companyWhere: string | { notIn: string[] };
  /** Solo los tratos asignados a esta persona (vendedor sin permiso de ver al equipo). */
  salesPersonId?: string | null;
  /** Agrupar por vendedor (necesita leer los estatus de la empresa). */
  bySeller?: boolean;
};

type Change = {
  statusId: string;
  companyId: string | null;
  businessLeadId: string | null;
  fromStatus: string | null;
  toStatus: string;
  changedAt: Date;
};

type Group = {
  entered: number;
  contacted: number;
  contactedWithin2Days: number;
  won: number;
  lost: number;
  cycles: number[];
  firstContactHours: number[];
  stalled: number;
};

const emptyGroup = (): Group => ({
  entered: 0,
  contacted: 0,
  contactedWithin2Days: 0,
  won: 0,
  lost: 0,
  cycles: [],
  firstContactHours: [],
  stalled: 0,
});

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

export const rate = (part: number, total: number) =>
  total ? Math.round((part / total) * 1000) / 1000 : null;
const isOpen = (stage: string) => !WON.has(stage) && !LOST.has(stage);
const isProgress = (from: string, to: string) => !LOST.has(to) && (RANK[to] ?? 0) > (RANK[from] ?? 0);

function finish(group: Group): VelocityGroupStats {
  return {
    entered: group.entered,
    contacted: group.contacted,
    contactedWithin2Days: group.contactedWithin2Days,
    won: group.won,
    lost: group.lost,
    winRate: rate(group.won, group.won + group.lost),
    medianCycleDays: median(group.cycles),
    medianFirstContactHours: median(group.firstContactHours),
    stalled: group.stalled,
  };
}

/** Si la tabla no existe todavía (antes de migrar), el Prisma de Keystone devuelve el error. */
async function rows<T>(read: () => Promise<T | Error>, fallback: T): Promise<T> {
  try {
    const result = await read();
    return result instanceof Error ? fallback : result;
  } catch {
    return fallback;
  }
}

export async function computeSalesVelocity(prisma: any, options: SalesVelocityOptions): Promise<SalesVelocity> {
  const { days, companyWhere } = options;
  const now = Date.now();
  const since = new Date(now - days * DAY_MS);
  const sinceMs = since.getTime();
  const lookback = new Date(now - (days + LOOKBACK_DAYS) * DAY_MS);
  const sellerScope = options.salesPersonId ?? null;
  const needStatuses = Boolean(options.bySeller || sellerScope);

  const [allChanges, firstChange, activities, allMessages, statuses] = await Promise.all([
    rows<Change[]>(
      () =>
        prisma.techLeadStageChange.findMany({
          where: { changedAt: { gte: lookback }, companyId: companyWhere },
          orderBy: [{ changedAt: "asc" }, { id: "asc" }],
          select: { statusId: true, companyId: true, businessLeadId: true, fromStatus: true, toStatus: true, changedAt: true },
        }),
      [],
    ),
    rows<{ changedAt: Date } | null>(
      () =>
        prisma.techLeadStageChange.findFirst({
          where: { companyId: companyWhere },
          orderBy: { changedAt: "asc" },
          select: { changedAt: true },
        }),
      null,
    ),
    rows<Array<{ businessLeadId: string; createdAt: Date; workspace: { companyId: string | null } | null; createdBy: { companyId: string | null } | null }>>(
      () =>
        prisma.techSalesActivity.findMany({
          where: { createdAt: { gte: since }, businessLeadId: { not: null } },
          select: {
            businessLeadId: true,
            createdAt: true,
            workspace: { select: { companyId: true } },
            createdBy: { select: { companyId: true } },
          },
        }),
      [],
    ),
    rows<Array<{ companyId: string; businessLeadId: string; direction: string; createdAt: Date }>>(
      () =>
        prisma.techWhatsAppMessage.findMany({
          where: {
            createdAt: { gte: since },
            businessLeadId: { not: null },
            companyId: companyWhere,
            OR: [{ source: null }, { source: { not: "imported" } }],
          },
          orderBy: { createdAt: "asc" },
          select: { companyId: true, businessLeadId: true, direction: true, createdAt: true },
        }),
      [],
    ),
    needStatuses
      ? rows<StatusSellers[]>(
          () =>
            prisma.techStatusBusinessLead.findMany({
              where: { saasCompanyId: companyWhere },
              select: {
                id: true,
                saasCompanyId: true,
                businessLeadId: true,
                businessLead: { select: { salesPerson: { select: { id: true, companyId: true } } } },
              },
            }),
          [],
        )
      : Promise.resolve([] as StatusSellers[]),
  ]);

  // Vendedores del lead que son de la empresa del estatus (un lead puede estar en varias empresas).
  const sellersOf = (status: StatusSellers) =>
    (status.businessLead?.salesPerson ?? [])
      .filter((user) => user.companyId === status.saasCompanyId)
      .map((user) => user.id);
  const sellerOf = new Map(statuses.map((status) => [status.id, sellersOf(status)[0] ?? ""]));
  // Vendedor sin permiso de ver al equipo: solo sus tratos y las conversaciones con sus leads.
  const ownStatuses = sellerScope ? statuses.filter((s) => sellersOf(s).includes(sellerScope)) : null;
  const ownStatusIds = ownStatuses ? new Set(ownStatuses.map((s) => s.id)) : null;
  const ownLeadIds = ownStatuses
    ? new Set(ownStatuses.filter((s) => s.businessLeadId).map((s) => s.businessLeadId as string))
    : null;
  const changes = ownStatusIds ? allChanges.filter((change) => ownStatusIds.has(change.statusId)) : allChanges;
  const messages = ownLeadIds ? allMessages.filter((m) => ownLeadIds.has(m.businessLeadId)) : allMessages;

  const byStatus = new Map<string, Change[]>();
  for (const change of changes) {
    const list = byStatus.get(change.statusId) ?? [];
    list.push(change);
    byStatus.set(change.statusId, list);
  }

  // Primer contacto fuera del pipeline: actividad o WhatsApp saliente de la empresa a ese lead.
  const contactKey = (company: string | null, lead: string | null) => `${company}|${lead}`;
  const contactTimes = new Map<string, number[]>();
  const addContact = (key: string, at: Date) => {
    const list = contactTimes.get(key) ?? [];
    list.push(new Date(at).getTime());
    contactTimes.set(key, list);
  };
  for (const activity of activities) {
    const company = activity.workspace?.companyId ?? activity.createdBy?.companyId ?? null;
    if (company) addContact(contactKey(company, activity.businessLeadId), activity.createdAt);
  }
  for (const message of messages) {
    if (message.direction !== "inbound") addContact(contactKey(message.companyId, message.businessLeadId), message.createdAt);
  }

  const stageStats = new Map<string, { entered: number; advanced: number; lost: number; durations: number[]; stalled: number }>();
  const stageOf = (stage: string) => {
    const stats = stageStats.get(stage) ?? { entered: 0, advanced: 0, lost: 0, durations: [], stalled: 0 };
    stageStats.set(stage, stats);
    return stats;
  };
  const total = emptyGroup();
  const companies = new Map<string, Group>();
  const sellers = new Map<string, Group>();
  const groupsFor = (companyId: string | null, statusId: string) => {
    const list = [total];
    if (companyId) {
      const group = companies.get(companyId) ?? emptyGroup();
      companies.set(companyId, group);
      list.push(group);
    }
    if (needStatuses) {
      const seller = sellerOf.get(statusId) ?? "";
      const group = sellers.get(seller) ?? emptyGroup();
      sellers.set(seller, group);
      list.push(group);
    }
    return list;
  };

  const wonStatusIds: string[] = [];
  const stalledDeals: StalledDeal[] = [];
  const cycles: number[] = [];

  for (const [statusId, history] of byStatus) {
    const last = history[history.length - 1];
    const groups = groupsFor(last.companyId, statusId);
    const entry = history[0].fromStatus == null ? history[0] : null;

    history.forEach((change, index) => {
      const at = change.changedAt.getTime();
      const next = history[index + 1];
      if (at >= sinceMs) {
        const stage = stageOf(change.toStatus);
        stage.entered += 1;
        if (next) {
          if (isProgress(change.toStatus, next.toStatus)) stage.advanced += 1;
          if (LOST.has(next.toStatus)) stage.lost += 1;
        }
        if (WON.has(change.toStatus) && !(change.fromStatus && WON.has(change.fromStatus))) {
          wonStatusIds.push(statusId);
          for (const group of groups) group.won += 1;
          if (entry) {
            const cycle = (at - entry.changedAt.getTime()) / DAY_MS;
            cycles.push(cycle);
            for (const group of groups) group.cycles.push(cycle);
          }
        }
        if (LOST.has(change.toStatus) && !(change.fromStatus && LOST.has(change.fromStatus))) {
          for (const group of groups) group.lost += 1;
        }
      }
      // Lo que duró la etapa cuenta si salió de ella dentro del periodo.
      if (next && next.changedAt.getTime() >= sinceMs) {
        stageOf(change.toStatus).durations.push((next.changedAt.getTime() - at) / DAY_MS);
      }
    });

    // Estancado: la última etapa sigue abierta (de Contactado en adelante) y no se movió en 14 días.
    const idle = now - last.changedAt.getTime();
    if (isOpen(last.toStatus) && (RANK[last.toStatus] ?? 0) >= CONTACT_RANK && idle >= STALLED_DAYS * DAY_MS) {
      stageOf(last.toStatus).stalled += 1;
      for (const group of groups) group.stalled += 1;
      stalledDeals.push({
        statusId,
        companyId: last.companyId,
        businessLeadId: last.businessLeadId,
        salesPersonId: sellerOf.get(statusId) || null,
        stage: last.toStatus,
        since: last.changedAt,
        days: Math.floor(idle / DAY_MS),
      });
    }

    // Leads nuevos del periodo y su primer contacto.
    if (entry && entry.changedAt.getTime() >= sinceMs) {
      for (const group of groups) group.entered += 1;
      const enteredAt = entry.changedAt.getTime();
      const candidates: number[] = [];
      const reached = history.find((change) => (RANK[change.toStatus] ?? 0) >= CONTACT_RANK);
      if (reached) candidates.push(reached.changedAt.getTime());
      for (const at of contactTimes.get(contactKey(last.companyId, entry.businessLeadId)) ?? []) {
        if (at >= enteredAt) candidates.push(at);
      }
      if (candidates.length) {
        const hours = (Math.min(...candidates) - enteredAt) / (60 * 60 * 1000);
        for (const group of groups) {
          group.contacted += 1;
          if (hours <= 48) group.contactedWithin2Days += 1;
          group.firstContactHours.push(hours);
        }
      }
    }
  }

  // WhatsApp: tiempo para contestar a un lead y tasa de respuesta a los mensajes de la empresa.
  const conversations = new Map<string, Array<{ direction: "in" | "out"; at: number }>>();
  for (const message of messages) {
    const key = contactKey(message.companyId, message.businessLeadId);
    const list = conversations.get(key) ?? [];
    list.push({ direction: message.direction === "inbound" ? "in" : "out", at: new Date(message.createdAt).getTime() });
    conversations.set(key, list);
  }
  let whatsappInbound = 0;
  let whatsappAnswered = 0;
  let whatsappAnsweredWithin1h = 0;
  let whatsappConversations = 0;
  let whatsappReplied = 0;
  const responseMinutes: number[] = [];
  for (const list of conversations.values()) {
    list.forEach((message, index) => {
      // Solo el primer mensaje de cada racha del lead: si escribe tres seguidos, es una pregunta.
      if (message.direction !== "in" || list[index - 1]?.direction === "in") return;
      whatsappInbound += 1;
      const reply = list.slice(index + 1).find((m) => m.direction === "out");
      if (!reply) return;
      whatsappAnswered += 1;
      const minutes = (reply.at - message.at) / 60000;
      responseMinutes.push(minutes);
      if (minutes <= 60) whatsappAnsweredWithin1h += 1;
    });
    const firstOut = list.findIndex((m) => m.direction === "out");
    if (firstOut >= 0 && (firstOut === 0 || list[firstOut - 1].direction === "out")) {
      whatsappConversations += 1;
      const start = list[firstOut].at;
      if (list.slice(firstOut + 1).some((m) => m.direction === "in" && m.at - start <= WHATSAPP_REPLY_WINDOW_MS)) {
        whatsappReplied += 1;
      }
    }
  }

  const wonStatuses: Array<{ estimatedValue: number | null }> = wonStatusIds.length
    ? await rows(
        () =>
          prisma.techStatusBusinessLead.findMany({
            where: { id: { in: wonStatusIds } },
            select: { estimatedValue: true },
          }),
        [] as Array<{ estimatedValue: number | null }>,
      )
    : [];
  const wonValue = wonStatuses.reduce((sum, row) => sum + (row.estimatedValue ?? 0), 0);

  const stageOrder = Object.values(PIPELINE_STATUS) as string[];
  const totals = finish(total);
  return {
    days,
    dataSince: firstChange?.changedAt ?? null,
    stages: stageOrder
      .filter((stage) => stageStats.has(stage))
      .map((stage) => {
        const stats = stageStats.get(stage)!;
        return {
          stage,
          entered: stats.entered,
          advanced: stats.advanced,
          lost: stats.lost,
          medianDays: median(stats.durations),
          stalled: stats.stalled,
        };
      }),
    won: totals.won,
    lost: totals.lost,
    winRate: totals.winRate,
    wonValue: Math.round(wonValue * 100) / 100,
    medianCycleDays: median(cycles),
    cycleSample: cycles.length,
    newLeads: totals.entered,
    contacted: totals.contacted,
    contactedWithin2Days: totals.contactedWithin2Days,
    medianFirstContactHours: totals.medianFirstContactHours,
    stalled: totals.stalled,
    whatsappInbound,
    whatsappAnswered,
    whatsappAnsweredWithin1h,
    whatsappMedianResponseMinutes: median(responseMinutes),
    whatsappConversations,
    whatsappReplied,
    byCompany: new Map([...companies].map(([id, group]) => [id, finish(group)])),
    bySeller: new Map([...sellers].map(([id, group]) => [id, finish(group)])),
    stalledDeals: stalledDeals.sort((a, b) => b.days - a.days),
  };
}
