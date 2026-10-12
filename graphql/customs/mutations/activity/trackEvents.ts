import type { KeystoneContext } from "@keystone-6/core/types";
import {
  ACTIVITY_EVENT,
  ACTIVITY_SOURCE,
  CLIENT_ADMIN_EVENT_TYPES,
  CLIENT_EVENT_TYPES,
  HEARTBEAT_EVENT,
  HEARTBEAT_MINUTES,
} from "../../../../models/ActivityEvent/constants";
import {
  getSessionCompanyId,
  getSessionUserId,
  isPlatformAdmin,
} from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";
import { getImpersonation } from "../../../../auth/impersonation";

/**
 * Eventos que solo conoce el navegador: qué secciones abre la gente, qué módulos bloqueados ve,
 * tours, exportaciones, salida, y el latido de tiempo activo. También el registro de qué empresas
 * y personas abre el admin de Kadesh en Operaciones.
 *
 * El servidor pone actor y empresa desde la sesión; del cliente solo acepta tipos de una lista
 * cerrada (`CLIENT_EVENT_TYPES`; `admin.*` solo para admin de plataforma).
 */

const typeDefs = `
  input TrackEventInput {
    """ui.section_viewed, ui.feature_locked_viewed, ui.upgrade_clicked, ui.tour_completed, ui.tour_skipped, lead.exported, auth.logout, auth.heartbeat, admin.viewed_company, admin.viewed_person, admin.viewed_ai_prompt"""
    type: String!
    """Datos chicos y planos: sección, módulo, conteo… (sin datos personales)."""
    metadata: JSON
    entityType: String
    entityId: String
    """Solo admin.*: la empresa que se está viendo."""
    companyId: ID
    """Hora del navegador (ISO). Se usa si es de los últimos 10 minutos."""
    occurredAt: String
  }

  type TrackEventsResult {
    accepted: Int!
    rejected: Int!
  }

  type Mutation {
    trackEvents(events: [TrackEventInput!]!): TrackEventsResult!
  }
`;

const definition = `
  trackEvents(events: [TrackEventInput!]!): TrackEventsResult!
`;

type TrackEventInput = {
  type: string;
  metadata?: unknown;
  entityType?: string | null;
  entityId?: string | null;
  companyId?: string | null;
  occurredAt?: string | null;
};

const MAX_EVENTS = 50;
const MAX_METADATA_KEYS = 20;
const MAX_TEXT = 200;
const CLOCK_WINDOW_MS = 10 * 60 * 1000;
/** Abrir varias veces la misma ficha en este lapso cuenta como una sola vista. */
const ADMIN_VIEW_DEDUPE_MS = 10 * 60 * 1000;
const MX_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function text(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Solo valores planos (texto, número, booleano): el front no manda objetos anidados. */
function flatMetadata(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_METADATA_KEYS)) {
    const k = key.slice(0, 40);
    if (typeof v === "string") out[k] = v.slice(0, MAX_TEXT);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean" || v === null) out[k] = v;
  }
  return out;
}

function clientTime(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const at = new Date(value);
  const diff = Date.now() - at.getTime();
  if (Number.isNaN(at.getTime()) || diff > CLOCK_WINDOW_MS || diff < -60_000) return undefined;
  return at;
}

function summaryFor(type: string, meta: Record<string, unknown>, label: string | null): string {
  const section = text(meta.section) ?? text(meta.tab) ?? "una sección";
  const feature = text(meta.feature) ?? text(meta.featureKey) ?? "un módulo";
  const tour = text(meta.tour) ?? text(meta.tourId) ?? "";
  switch (type) {
    case ACTIVITY_EVENT.UI_SECTION_VIEWED:
      return `Abrió ${section}`;
    case ACTIVITY_EVENT.UI_FEATURE_LOCKED_VIEWED:
      return `Vio bloqueado: ${feature}`;
    case ACTIVITY_EVENT.UI_UPGRADE_CLICKED:
      return `Hizo clic en mejorar plan (${feature})`;
    case ACTIVITY_EVENT.UI_TOUR_COMPLETED:
      return `Completó el tour ${tour}`.trim();
    case ACTIVITY_EVENT.UI_TOUR_SKIPPED:
      return `Saltó el tour ${tour}`.trim();
    case ACTIVITY_EVENT.LEAD_EXPORTED: {
      const count = typeof meta.count === "number" ? meta.count : null;
      return count != null ? `Exportó ${count} leads` : "Exportó leads";
    }
    case ACTIVITY_EVENT.AUTH_LOGOUT:
      return "Cerró sesión";
    case ACTIVITY_EVENT.ADMIN_VIEWED_COMPANY:
      return `Abrió el 360 de ${label ?? "una empresa"}`;
    case ACTIVITY_EVENT.ADMIN_VIEWED_PERSON:
      return `Abrió la ficha de ${label ?? "una persona"}`;
    case ACTIVITY_EVENT.ADMIN_VIEWED_AI_PROMPT:
      return `Vio una conversación de IA${label ? ` de ${label}` : ""}`;
    default:
      return type;
  }
}

/**
 * Suma minutos activos del día (hora de CDMX). Un latido más seguido que el intervalo no suma:
 * así nadie infla su tiempo llamando la mutación en bucle.
 */
async function recordHeartbeat(
  context: KeystoneContext,
  userId: string,
  companyId: string | null,
): Promise<boolean> {
  const prisma = context.sudo().prisma as any;
  if (!prisma?.userActivityDay) return false;
  const now = new Date();
  const day = MX_DAY.format(now);
  const key = `${userId}:${day}`;

  const existing: { lastSeenAt: Date | null } | null = await prisma.userActivityDay.findUnique({
    where: { key },
    select: { lastSeenAt: true },
  });

  if (!existing) {
    try {
      await prisma.userActivityDay.create({
        data: {
          key,
          userId,
          companyId,
          day: new Date(`${day}T00:00:00.000Z`),
          minutes: HEARTBEAT_MINUTES,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
      return true;
    } catch {
      // Otra pestaña creó la fila al mismo tiempo: sigue como update.
    }
  }

  const last = existing?.lastSeenAt ? new Date(existing.lastSeenAt).getTime() : 0;
  const tooSoon = now.getTime() - last < (HEARTBEAT_MINUTES - 1) * 60_000;
  await prisma.userActivityDay.update({
    where: { key },
    data: {
      lastSeenAt: now,
      companyId,
      ...(tooSoon ? {} : { minutes: { increment: HEARTBEAT_MINUTES } }),
    },
  });
  return true;
}

async function adminViewLabel(
  context: KeystoneContext,
  type: string,
  input: TrackEventInput,
): Promise<{ label: string | null; companyId: string | null }> {
  const prisma = context.sudo().prisma as any;
  if (type === ACTIVITY_EVENT.ADMIN_VIEWED_COMPANY && input.companyId) {
    const company = await prisma.saasCompany.findUnique({
      where: { id: input.companyId },
      select: { name: true },
    });
    return { label: company?.name ?? null, companyId: input.companyId };
  }
  if (type === ACTIVITY_EVENT.ADMIN_VIEWED_PERSON && input.entityId) {
    const user = await prisma.user.findUnique({
      where: { id: input.entityId },
      select: { name: true, lastName: true, email: true, companyId: true },
    });
    const name = [user?.name, user?.lastName].filter(Boolean).join(" ") || user?.email || null;
    return { label: name, companyId: input.companyId ?? user?.companyId ?? null };
  }
  if (type === ACTIVITY_EVENT.ADMIN_VIEWED_AI_PROMPT && input.entityId) {
    const call = await prisma.techAiCallLog.findUnique({
      where: { id: input.entityId },
      select: { companyId: true, company: { select: { name: true } } },
    });
    return { label: call?.company?.name ?? null, companyId: call?.companyId ?? input.companyId ?? null };
  }
  return { label: null, companyId: input.companyId ?? null };
}

async function recentlyViewed(
  context: KeystoneContext,
  actorId: string,
  type: string,
  companyId: string | null,
  entityId: string | null,
): Promise<boolean> {
  const prisma = context.sudo().prisma as any;
  if (!prisma?.activityEvent) return false;
  const found = await prisma.activityEvent.findFirst({
    where: {
      actorId,
      type,
      companyId,
      entityId,
      createdAt: { gte: new Date(Date.now() - ADMIN_VIEW_DEDUPE_MS) },
    },
    select: { id: true },
  });
  return Boolean(found);
}

const resolver = {
  trackEvents: async (
    _root: unknown,
    { events }: { events: TrackEventInput[] },
    context: KeystoneContext,
  ) => {
    const session = context.session as Parameters<typeof getSessionUserId>[0];
    const userId = getSessionUserId(session);
    const list = Array.isArray(events) ? events : [];
    if (!userId) return { accepted: 0, rejected: list.length };
    // Viendo como otra persona: lo que hace el admin no es uso del cliente (ni sus minutos).
    if (getImpersonation(context.session)) return { accepted: 0, rejected: list.length };

    const companyId = getSessionCompanyId(session);
    const admin = isPlatformAdmin(session);
    const batch = list.slice(0, MAX_EVENTS);
    let accepted = 0;
    let heartbeatDone = false;

    for (const input of batch) {
      const type = text(input?.type, 60);
      if (!type) continue;
      try {
        if (type === HEARTBEAT_EVENT) {
          // Un latido por llamada basta: el front manda uno cada 5 minutos.
          if (!heartbeatDone) {
            heartbeatDone = true;
            if (await recordHeartbeat(context, userId, companyId)) accepted += 1;
          }
          continue;
        }

        const metadata = flatMetadata(input.metadata);
        const occurredAt = clientTime(input.occurredAt);

        if (CLIENT_EVENT_TYPES.has(type)) {
          await logActivity(context, {
            type,
            summary: summaryFor(type, metadata, null),
            entityType: text(input.entityType, 60),
            entityId: text(input.entityId, 60),
            metadata,
            source: ACTIVITY_SOURCE.WEB,
            occurredAt,
          });
          accepted += 1;
          continue;
        }

        if (CLIENT_ADMIN_EVENT_TYPES.has(type) && admin) {
          const entityId = text(input.entityId, 60);
          const target = await adminViewLabel(context, type, input);
          if (await recentlyViewed(context, userId, type, target.companyId, entityId)) {
            accepted += 1;
            continue;
          }
          await logActivity(context, {
            type,
            summary: summaryFor(type, metadata, target.label),
            companyId: target.companyId,
            entityType: text(input.entityType, 60),
            entityId,
            metadata,
            source: ACTIVITY_SOURCE.ADMIN,
            occurredAt,
          });
          accepted += 1;
        }
      } catch (error) {
        console.warn(
          `[activity] trackEvents ${type}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return { accepted, rejected: list.length - accepted };
  },
};

export default { typeDefs, definition, resolver };
