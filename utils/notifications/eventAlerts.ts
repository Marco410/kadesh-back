import type { KeystoneContext } from "@keystone-6/core/types";
import { NOTIFICATION_TYPE, type NotificationType } from "../../models/Notification/constants";
import {
  PET_EVENT_ALERTS,
  PET_EVENT_CATEGORY_OPTIONS,
  PET_EVENT_SCOPE,
  PET_EVENT_STATUS,
} from "../../models/Pet/PetEvent/constants";
import { DEFAULT_TIME_ZONE } from "../geo/mexicoStates";
import { notify } from "./notify";
import { petSiteUrl } from "./whatsapp";

/**
 * Avisos de eventos de Kadesh Pet (campana + push). Reglas en models/Pet/PetEvent/README.md:
 * - `event.nearby`: a quien tiene `eventAlertsEnabled` y un centro de alertas, si su zona toca el
 *   área del evento, o si el evento es de su municipio / estado / nacional. Máx. 3 al día por
 *   persona, nunca el mismo evento dos veces, nunca a quien lo organiza.
 * - Recordatorios, cancelaciones y cambios: a quienes marcaron «Me interesa» o «Asistiré».
 * Ninguna función lanza: un aviso que falla no frena la operación que lo dispara.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type PetEventNotice = {
  id: string;
  slug: string | null;
  title: string;
  category: string;
  scope: string;
  reachKm: number;
  lat: number;
  lng: number;
  placeLabel: string;
  neighborhood: string;
  city: string;
  cityKey: string | null;
  state: string;
  stateCode: string | null;
  timeZone: string;
  isFree: boolean;
  price: number | null;
  priceNote: string;
  status: string;
  userId: string | null;
  zoneAlertsSentAt: Date | null;
  /** Próxima fecha que no ha terminado. */
  next: { id: string; startsAt: Date; endsAt: Date } | null;
};

export type EventAlertCandidate = {
  id: string;
  distanceKm: number;
  /** Avisos de eventos de zona en las últimas 24 h (tope: PET_EVENT_ALERTS.MAX_PER_DAY). */
  alertsToday: number;
  alreadyAlerted: boolean;
};

function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

export function petEventUrl(slug: string | null | undefined): string {
  return slug ? petSiteUrl(`/eventos/${slug}`) : petSiteUrl("/eventos");
}

/** "Campaña de esterilización", "Feria de adopción"… */
export function petEventCategoryTitle(category: string | null | undefined): string {
  return PET_EVENT_CATEGORY_OPTIONS.find((option) => option.value === category)?.title ?? "Evento";
}

/** "sáb 8 nov, 9:00" en la zona horaria del evento. */
export function formatEventWhen(date: Date, timeZone: string | null | undefined): string {
  const tz = timeZone || DEFAULT_TIME_ZONE;
  try {
    const parts = new Intl.DateTimeFormat("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: tz,
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      (parts.find((part) => part.type === type)?.value ?? "").replace(/\./g, "");
    return `${get("weekday")} ${Number(get("day"))} ${get("month")}, ${Number(get("hour"))}:${get("minute")}`;
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}

/** "2026-11-08" en la zona horaria del evento (para "hoy" / "mañana"). */
function dayKey(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** "Hoy", "Mañana" o null, según el día de la fecha en la zona del evento. */
export function relativeEventDay(date: Date, timeZone: string, now = new Date()): "Hoy" | "Mañana" | null {
  const key = dayKey(date, timeZone);
  if (key === dayKey(now, timeZone)) return "Hoy";
  if (key === dayKey(new Date(now.getTime() + DAY_MS), timeZone)) return "Mañana";
  return null;
}

/** "Explanada del Jardín Morelos, Morelia" o "Col. Centro, Morelia". */
export function eventPlaceText(event: Pick<PetEventNotice, "placeLabel" | "neighborhood" | "city" | "state">): string {
  const place = event.placeLabel?.trim() || event.neighborhood?.trim() || "";
  const city = event.city?.trim() || event.state?.trim() || "";
  return [place, city].filter(Boolean).join(", ");
}

/** "Gratis", "$150" o la nota de la cuota. */
export function eventPriceText(event: Pick<PetEventNotice, "isFree" | "price" | "priceNote">): string {
  if (event.isFree) return "Gratis";
  if (event.price) return `$${event.price.toLocaleString("es-MX")}`;
  return event.priceNote?.trim() || "";
}

/** ¿La próxima fecha está tan cerca como para avisar a la zona? */
export function isWithinAlertLead(startsAt: Date | null | undefined, now = new Date()): boolean {
  if (!startsAt) return false;
  return startsAt.getTime() - now.getTime() <= PET_EVENT_ALERTS.LEAD_DAYS * DAY_MS;
}

/** El evento con lo que necesitan los avisos (sin access control). */
export async function loadPetEventForNotice(
  context: KeystoneContext,
  eventId: string,
  now = new Date(),
): Promise<PetEventNotice | null> {
  try {
    const prisma = prismaOf(context);
    const row = await prisma.petEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        scope: true,
        reachKm: true,
        lat: true,
        lng: true,
        placeLabel: true,
        neighborhood: true,
        city: true,
        cityKey: true,
        state: true,
        stateCode: true,
        timeZone: true,
        isFree: true,
        price: true,
        priceNote: true,
        status: true,
        userId: true,
        zoneAlertsSentAt: true,
      },
    });
    if (!row || row instanceof Error) return null;
    const next = await prisma.petEventSession.findFirst({
      where: { eventId, endsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true, endsAt: true },
    });
    return {
      ...row,
      reachKm: Number(row.reachKm ?? 0),
      lat: Number(row.lat),
      lng: Number(row.lng),
      timeZone: row.timeZone || DEFAULT_TIME_ZONE,
      next: next && !(next instanceof Error) ? next : null,
    } as PetEventNotice;
  } catch (error) {
    console.error("[event-alerts] No se pudo leer el evento:", eventId, error);
    return null;
  }
}

/**
 * Personas a las que les toca el evento, de la más cercana a la más lejana. No aplica el tope del
 * día ni «ya avisado»: eso lo decide quien llama (la vista previa de Operaciones los muestra).
 */
export async function findEventAlertCandidates(
  context: KeystoneContext,
  event: Pick<PetEventNotice, "id" | "lat" | "lng" | "scope" | "reachKm" | "stateCode" | "cityKey" | "userId">,
): Promise<EventAlertCandidate[]> {
  const prisma = prismaOf(context);
  const since = new Date(Date.now() - DAY_MS);
  const zoneReach = event.scope === PET_EVENT_SCOPE.ZONE ? Math.max(0, Math.round(event.reachKm || 0)) : 0;
  const rows = await prisma.$queryRaw`
    SELECT u.id,
      d.km AS "distanceKm",
      (SELECT COUNT(*)::int FROM "Notification" n
        WHERE n.recipient = u.id AND n.type = ${NOTIFICATION_TYPE.EVENT_NEARBY} AND n."createdAt" >= ${since}) AS "alertsToday",
      EXISTS (SELECT 1 FROM "Notification" n
        WHERE n.recipient = u.id AND n.type = ${NOTIFICATION_TYPE.EVENT_NEARBY} AND n."entityId" = ${event.id}) AS "alreadyAlerted"
    FROM "User" u
    CROSS JOIN LATERAL (
      SELECT 6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(${event.lat}::float8)) * cos(radians(u."alertLat")) * cos(radians(u."alertLng") - radians(${event.lng}::float8))
        + sin(radians(${event.lat}::float8)) * sin(radians(u."alertLat"))
      ))) AS km
    ) d
    WHERE u."eventAlertsEnabled" = true
      AND u."alertLat" IS NOT NULL
      AND u."alertLng" IS NOT NULL
      AND u."suspendedAt" IS NULL
      AND u."anonymizedAt" IS NULL
      AND u.id <> ${event.userId ?? ""}
      AND (
        d.km <= u."alertRadiusKm" + ${zoneReach}::int
        OR (${event.scope}::text = ${PET_EVENT_SCOPE.CITY}
          AND u."alertStateCode" = ${event.stateCode}::text AND u."alertCityKey" = ${event.cityKey}::text)
        OR (${event.scope}::text = ${PET_EVENT_SCOPE.STATE} AND u."alertStateCode" = ${event.stateCode}::text)
        OR ${event.scope}::text = ${PET_EVENT_SCOPE.NATIONAL}
      )
    ORDER BY d.km ASC
  `;
  // Prisma de Keystone devuelve el error en vez de lanzarlo.
  if (rows instanceof Error) throw rows;
  return (rows as Array<{ id: string; distanceKm: number; alertsToday: number; alreadyAlerted: boolean }>).map((row) => ({
    id: row.id,
    distanceKm: Number(row.distanceKm),
    alertsToday: Number(row.alertsToday),
    alreadyAlerted: Boolean(row.alreadyAlerted),
  }));
}

/** Quiénes recibirían el aviso hoy (para Operaciones y para `notifyEventInZone`). */
export function pickEventAlertRecipients(candidates: EventAlertCandidate[]): string[] {
  return candidates
    .filter((row) => !row.alreadyAlerted && row.alertsToday < PET_EVENT_ALERTS.MAX_PER_DAY)
    .map((row) => row.id);
}

function scopePhrase(event: PetEventNotice): string {
  switch (event.scope) {
    case PET_EVENT_SCOPE.CITY:
      return event.city ? `en ${event.city}` : "en tu municipio";
    case PET_EVENT_SCOPE.STATE:
      return event.state ? `en ${event.state}` : "en tu estado";
    case PET_EVENT_SCOPE.NATIONAL:
      return "en todo México";
    default:
      return "cerca de ti";
  }
}

/**
 * Avisa a la zona de un evento aprobado. Quien llama decide cuándo (al aprobar o desde el cron,
 * a 14 días de la fecha) y marca `zoneAlertsSentAt`. Devuelve a cuántas personas se avisó.
 */
export async function notifyEventInZone(context: KeystoneContext, eventId: string): Promise<number> {
  try {
    const event = await loadPetEventForNotice(context, eventId);
    if (!event || event.status !== PET_EVENT_STATUS.APPROVED || !event.next) return 0;
    if (!Number.isFinite(event.lat) || !Number.isFinite(event.lng)) return 0;

    const recipientIds = pickEventAlertRecipients(await findEventAlertCandidates(context, event));
    if (recipientIds.length === 0) return 0;

    const when = formatEventWhen(event.next.startsAt, event.timeZone);
    const parts = [event.title, when, eventPlaceText(event), eventPriceText(event)].filter(Boolean);
    return await notify(context, {
      audience: recipientIds,
      product: "pet",
      type: NOTIFICATION_TYPE.EVENT_NEARBY,
      title: `${petEventCategoryTitle(event.category)} ${scopePhrase(event)}`,
      body: parts.join(" · "),
      entityType: "PetEvent",
      entityId: event.id,
      url: petEventUrl(event.slug),
      metadata: { slug: event.slug, category: event.category, scope: event.scope },
    });
  } catch (error) {
    console.error("[event-alerts] No se pudo avisar a la zona:", eventId, error);
    return 0;
  }
}

/** Ids de quienes marcaron «Me interesa» o «Asistiré». */
export async function interestedUserIds(context: KeystoneContext, eventId: string): Promise<string[]> {
  try {
    const rows = await prismaOf(context).petEventInterest.findMany({
      where: { eventId, userId: { not: null } },
      select: { userId: true },
    });
    if (rows instanceof Error) throw rows;
    return (rows as Array<{ userId: string }>).map((row) => row.userId);
  } catch (error) {
    console.error("[event-alerts] No se pudo leer a los interesados:", eventId, error);
    return [];
  }
}

/** Aviso a quienes marcaron «Me interesa» o «Asistiré» (cancelación o cambio de fechas/lugar). */
export async function notifyEventInterested(
  context: KeystoneContext,
  eventId: string,
  input: { type: NotificationType; title: string; body?: string | null; excludeUserId?: string | null },
): Promise<number> {
  const event = await loadPetEventForNotice(context, eventId);
  if (!event) return 0;
  const audience = (await interestedUserIds(context, eventId)).filter((id) => id !== input.excludeUserId);
  if (audience.length === 0) return 0;
  return notify(context, {
    audience,
    product: "pet",
    type: input.type,
    title: input.title,
    body: input.body ?? event.title,
    entityType: "PetEvent",
    entityId: event.id,
    url: petEventUrl(event.slug),
    metadata: { slug: event.slug },
  });
}

/** Aviso a quien publicó el evento (aprobado / rechazado). */
export async function notifyEventOwner(
  context: KeystoneContext,
  event: Pick<PetEventNotice, "id" | "slug" | "userId">,
  input: { type: NotificationType; title: string; body?: string | null; url?: string | null },
): Promise<number> {
  if (!event.userId) return 0;
  return notify(context, {
    audience: [event.userId],
    product: "pet",
    type: input.type,
    title: input.title,
    body: input.body ?? "",
    entityType: "PetEvent",
    entityId: event.id,
    url: input.url ?? petEventUrl(event.slug),
    metadata: { slug: event.slug },
  });
}

/** A los admins: un evento nuevo o editado espera revisión (Operaciones → Kadesh Pet → Eventos). */
export async function notifyEventSubmitted(
  context: KeystoneContext,
  event: Pick<PetEventNotice, "id" | "slug" | "title" | "city" | "state">,
  { edited }: { edited: boolean },
): Promise<number> {
  return notify(context, {
    audience: "platform_admins",
    product: "pet",
    type: NOTIFICATION_TYPE.EVENT_SUBMITTED,
    title: edited ? `Evento editado por revisar: ${event.title}` : `Evento por revisar: ${event.title}`,
    body: [event.city, event.state].filter(Boolean).join(", "),
    entityType: "PetEvent",
    entityId: event.id,
    metadata: { slug: event.slug, edited },
  });
}
