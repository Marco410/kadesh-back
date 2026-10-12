import type { KeystoneContext } from "@keystone-6/core/types";
import { PIPELINE_STATUS } from "../../../../models/Saas/Tech/crm/constants";
import {
  DAY_MS,
  adminPrisma,
  analyticsExcludedCompanyIds,
  assertPlatformAdmin,
  clampInt,
  daysAgo,
  optionalRead,
  toIso,
} from "./shared";

/**
 * Velocidad comercial: qué tan rápido mueven sus leads las empresas, a partir del historial de
 * etapas (`TechLeadStageChange`), las actividades y los WhatsApp. Ver la decisión de la fase 5 en
 * `docs/operaciones/decisiones.md`.
 *
 * - Avanzar = pasar a una etapa más adelante. "Sin respuesta" cuenta al nivel de "Contactado".
 * - Ganado = Propuesta Aceptada o Cerrado Ganado. Perdido = Rechazada, Cerrado Perdido o Descartado.
 * - El historial existe desde que se empezó a guardar: lo anterior no se puede reconstruir, por eso
 *   se devuelve `dataSince` y el ciclo de venta solo cuenta leads que vimos entrar al pipeline.
 */

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
const STALLED_DAYS = 14;
/** Para saber cuánto duró una etapa que empezó antes del periodo. */
const LOOKBACK_DAYS = 180;
const WHATSAPP_REPLY_WINDOW_MS = 7 * DAY_MS;
const COMPANY_LIMIT = 25;

const typeDefs = `
  input AdminSalesVelocityInput {
    """Últimos N días (30–365, por defecto 90)."""
    days: Int
    """Solo esta empresa (ficha 360)."""
    companyId: ID
  }

  type AdminStageVelocity {
    stage: String!
    """Leads que entraron a la etapa en el periodo."""
    entered: Int!
    """De esos, cuántos pasaron a una etapa más adelante."""
    advanced: Int!
    """De esos, cuántos se perdieron (rechazada, perdido o descartado)."""
    lost: Int!
    """Mediana de días que se quedaron en la etapa (solo los que ya salieron)."""
    medianDays: Float
    """Siguen ahí hace 14 días o más sin moverse."""
    stalled: Int!
  }

  type AdminCompanyVelocity {
    companyId: ID!
    companyName: String!
    entered: Int!
    won: Int!
    lost: Int!
    winRate: Float
    medianCycleDays: Float
    medianFirstContactHours: Float
    stalled: Int!
  }

  type AdminSalesVelocity {
    days: Int!
    """Desde cuándo hay historial de etapas (antes no se guardaba)."""
    dataSince: String
    stages: [AdminStageVelocity!]!
    won: Int!
    lost: Int!
    """Ganados ÷ (ganados + perdidos) cerrados en el periodo (0–1)."""
    winRate: Float
    """Suma del valor estimado de los ganados."""
    wonValue: Float!
    """Mediana de días desde que el lead entró al pipeline hasta ganarse."""
    medianCycleDays: Float
    cycleSample: Int!
    """Leads que entraron al pipeline en el periodo."""
    newLeads: Int!
    """De esos, cuántos ya tuvieron contacto."""
    contacted: Int!
    contactedWithin2Days: Int!
    medianFirstContactHours: Float
    """Tratos abiertos (de Contactado a Negociación) sin moverse en 14 días o más."""
    stalled: Int!
    whatsappInbound: Int!
    whatsappAnswered: Int!
    whatsappAnsweredWithin1h: Int!
    """Mediana de minutos para contestar un WhatsApp de un lead."""
    whatsappMedianResponseMinutes: Float
    """Conversaciones donde la empresa escribió primero."""
    whatsappConversations: Int!
    """De esas, en cuántas contestó el lead (en 7 días)."""
    whatsappReplied: Int!
    companies: [AdminCompanyVelocity!]!
  }

  type Query {
    adminSalesVelocity(input: AdminSalesVelocityInput): AdminSalesVelocity!
  }
`;

const definition = `
  adminSalesVelocity(input: AdminSalesVelocityInput): AdminSalesVelocity!
`;

type Change = {
  statusId: string;
  companyId: string | null;
  businessLeadId: string | null;
  fromStatus: string | null;
  toStatus: string;
  changedAt: Date;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

const rate = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 1000 : null);
const isOpen = (stage: string) => !WON.has(stage) && !LOST.has(stage);
const isProgress = (from: string, to: string) =>
  !LOST.has(to) && (RANK[to] ?? 0) > (RANK[from] ?? 0);

type CompanyStats = {
  entered: number;
  won: number;
  lost: number;
  cycles: number[];
  firstContactHours: number[];
  stalled: number;
};

const emptyStats = (): CompanyStats => ({ entered: 0, won: 0, lost: 0, cycles: [], firstContactHours: [], stalled: 0 });

const resolver = {
  adminSalesVelocity: async (
    _root: unknown,
    { input }: { input?: { days?: number | null; companyId?: string | null } | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const days = clampInt(input?.days, 30, 365, 90);
    const companyId = input?.companyId?.trim() || null;
    const now = Date.now();
    const since = daysAgo(days);
    const lookback = daysAgo(days + LOOKBACK_DAYS);
    const excluded = companyId ? [] : [...(await analyticsExcludedCompanyIds(prisma))];
    const companyWhere = companyId ? companyId : { notIn: excluded };

    const empty = {
      days,
      dataSince: null,
      stages: [],
      won: 0,
      lost: 0,
      winRate: null,
      wonValue: 0,
      medianCycleDays: null,
      cycleSample: 0,
      newLeads: 0,
      contacted: 0,
      contactedWithin2Days: 0,
      medianFirstContactHours: null,
      stalled: 0,
      whatsappInbound: 0,
      whatsappAnswered: 0,
      whatsappAnsweredWithin1h: 0,
      whatsappMedianResponseMinutes: null,
      whatsappConversations: 0,
      whatsappReplied: 0,
      companies: [],
    };
    if (!prisma.techLeadStageChange) return empty;

    const [changes, firstChange, activities, messages] = await Promise.all([
      optionalRead<Change[]>(
        () =>
          prisma.techLeadStageChange.findMany({
            where: { changedAt: { gte: lookback }, companyId: companyWhere },
            orderBy: [{ changedAt: "asc" }, { id: "asc" }],
            select: {
              statusId: true,
              companyId: true,
              businessLeadId: true,
              fromStatus: true,
              toStatus: true,
              changedAt: true,
            },
          }),
        [],
      ),
      optionalRead<{ changedAt: Date } | null>(
        () => prisma.techLeadStageChange.findFirst({ orderBy: { changedAt: "asc" }, select: { changedAt: true } }),
        null,
      ),
      prisma.techSalesActivity.findMany({
        where: { createdAt: { gte: since }, businessLeadId: { not: null } },
        select: {
          businessLeadId: true,
          createdAt: true,
          workspace: { select: { companyId: true } },
          createdBy: { select: { companyId: true } },
        },
      }),
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
    ]);

    // Historial por estatus (un lead dentro de una empresa), en orden.
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
    for (const activity of activities as Array<{
      businessLeadId: string;
      createdAt: Date;
      workspace: { companyId: string | null } | null;
      createdBy: { companyId: string | null } | null;
    }>) {
      const company = activity.workspace?.companyId ?? activity.createdBy?.companyId ?? null;
      if (company) addContact(contactKey(company, activity.businessLeadId), activity.createdAt);
    }
    for (const message of messages as Array<{ companyId: string; businessLeadId: string; direction: string; createdAt: Date }>) {
      if (message.direction !== "inbound") addContact(contactKey(message.companyId, message.businessLeadId), message.createdAt);
    }

    const stageStats = new Map<string, { entered: number; advanced: number; lost: number; durations: number[]; stalled: number }>();
    const stageOf = (stage: string) => {
      const stats = stageStats.get(stage) ?? { entered: 0, advanced: 0, lost: 0, durations: [], stalled: 0 };
      stageStats.set(stage, stats);
      return stats;
    };
    const perCompany = new Map<string, CompanyStats>();
    const companyStats = (id: string | null) => {
      const key = id ?? "";
      const stats = perCompany.get(key) ?? emptyStats();
      perCompany.set(key, stats);
      return stats;
    };

    let won = 0;
    let lost = 0;
    let newLeads = 0;
    let contacted = 0;
    let contactedWithin2Days = 0;
    let stalled = 0;
    const cycles: number[] = [];
    const firstContactHours: number[] = [];
    const wonStatusIds: string[] = [];
    const sinceMs = since.getTime();

    for (const [statusId, history] of byStatus) {
      const company = history[history.length - 1].companyId;
      const stats = companyStats(company);
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
            won += 1;
            stats.won += 1;
            wonStatusIds.push(statusId);
            if (entry) {
              const cycle = (at - entry.changedAt.getTime()) / DAY_MS;
              cycles.push(cycle);
              stats.cycles.push(cycle);
            }
          }
          if (LOST.has(change.toStatus) && !(change.fromStatus && LOST.has(change.fromStatus))) {
            lost += 1;
            stats.lost += 1;
          }
        }
        // Lo que duró la etapa cuenta si salió de ella dentro del periodo.
        if (next && next.changedAt.getTime() >= sinceMs) {
          stageOf(change.toStatus).durations.push((next.changedAt.getTime() - at) / DAY_MS);
        }
      });

      // Estancado: la última etapa sigue abierta (de Contactado en adelante) y no se movió en 14 días.
      const last = history[history.length - 1];
      const lastRank = RANK[last.toStatus] ?? 0;
      if (isOpen(last.toStatus) && lastRank >= CONTACT_RANK && now - last.changedAt.getTime() >= STALLED_DAYS * DAY_MS) {
        stageOf(last.toStatus).stalled += 1;
        stalled += 1;
        stats.stalled += 1;
      }

      // Leads nuevos del periodo y su primer contacto.
      if (entry && entry.changedAt.getTime() >= sinceMs) {
        newLeads += 1;
        stats.entered += 1;
        const enteredAt = entry.changedAt.getTime();
        const candidates: number[] = [];
        const reached = history.find((change) => (RANK[change.toStatus] ?? 0) >= CONTACT_RANK);
        if (reached) candidates.push(reached.changedAt.getTime());
        for (const at of contactTimes.get(contactKey(company, entry.businessLeadId)) ?? []) {
          if (at >= enteredAt) candidates.push(at);
        }
        if (candidates.length) {
          const hours = (Math.min(...candidates) - enteredAt) / (60 * 60 * 1000);
          contacted += 1;
          if (hours <= 48) contactedWithin2Days += 1;
          firstContactHours.push(hours);
          stats.firstContactHours.push(hours);
        }
      }
    }

    // WhatsApp: tiempo para contestar a un lead y tasa de respuesta a los mensajes de la empresa.
    const conversations = new Map<string, Array<{ direction: string; at: number }>>();
    for (const message of messages as Array<{ companyId: string; businessLeadId: string; direction: string; createdAt: Date }>) {
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

    const [wonStatuses, companies] = await Promise.all([
      wonStatusIds.length
        ? prisma.techStatusBusinessLead.findMany({
            where: { id: { in: wonStatusIds } },
            select: { estimatedValue: true },
          })
        : [],
      prisma.saasCompany.findMany({
        where: { id: { in: [...perCompany.keys()].filter(Boolean) } },
        select: { id: true, name: true },
      }),
    ]);
    const wonValue = (wonStatuses as Array<{ estimatedValue: number | null }>).reduce(
      (sum, row) => sum + (row.estimatedValue ?? 0),
      0,
    );
    const companyName = new Map((companies as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]));

    const stageOrder = Object.values(PIPELINE_STATUS) as string[];
    return {
      days,
      dataSince: toIso(firstChange?.changedAt ?? null),
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
      won,
      lost,
      winRate: rate(won, won + lost),
      wonValue: Math.round(wonValue * 100) / 100,
      medianCycleDays: median(cycles),
      cycleSample: cycles.length,
      newLeads,
      contacted,
      contactedWithin2Days,
      medianFirstContactHours: median(firstContactHours),
      stalled,
      whatsappInbound,
      whatsappAnswered,
      whatsappAnsweredWithin1h,
      whatsappMedianResponseMinutes: median(responseMinutes),
      whatsappConversations,
      whatsappReplied,
      companies: companyId
        ? []
        : [...perCompany.entries()]
            .filter(([id]) => id && companyName.has(id))
            .map(([id, stats]) => ({
              companyId: id,
              companyName: companyName.get(id) ?? "Empresa",
              entered: stats.entered,
              won: stats.won,
              lost: stats.lost,
              winRate: rate(stats.won, stats.won + stats.lost),
              medianCycleDays: median(stats.cycles),
              medianFirstContactHours: median(stats.firstContactHours),
              stalled: stats.stalled,
            }))
            .sort((a, b) => b.stalled - a.stalled || b.entered - a.entered)
            .slice(0, COMPANY_LIMIT),
    };
  },
};

export default { typeDefs, definition, resolver };
