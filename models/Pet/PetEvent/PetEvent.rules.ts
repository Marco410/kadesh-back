import type { KeystoneContext } from "@keystone-6/core/types";
import { cityKey, normalizeStateCode, stateByCode, timeZoneForState } from "../../../utils/geo/mexicoStates";
import { reverseGeocode } from "../../../utils/pet/nominatim";
import { normalizeMxPhone } from "../../../utils/pet/phone";
import { PET_PLACE_CLAIM_STATUS } from "../PetPlace/claim";
import {
  DEFAULT_PET_EVENT_REACH_KM,
  PET_EVENT_CATEGORY_OPTIONS,
  PET_EVENT_LIMITS,
  PET_EVENT_REACH_KM_OPTIONS,
  PET_EVENT_SCOPE,
  PET_EVENT_SCOPE_OPTIONS,
  PET_EVENT_SOCIAL_NETWORKS,
  PET_EVENT_SPECIES_OPTIONS,
  type PetEventSocialField,
} from "./constants";

/**
 * Reglas de un evento (lo que manda el formulario de la web o la app): validación, normalización y
 * ubicación. Las usan `submitPetEvent` y `updateMyPetEvent`. Ver README.md.
 */

export type PetEventSessionInput = { startsAt: string; endsAt: string };

export type PetEventInput = {
  title: string;
  category: string;
  species?: string[] | null;
  description: string;
  requirements?: string | null;
  organizerName?: string | null;
  contactPhone?: string | null;
  petPlaceId?: string | null;
  lat: number;
  lng: number;
  placeLabel?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  scope: string;
  reachKm?: number | null;
  isFree: boolean;
  price?: number | null;
  priceNote?: string | null;
  capacity?: number | null;
  registrationUrl?: string | null;
  registrationWhatsapp?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  xUrl?: string | null;
  websiteUrl?: string | null;
  sessions: PetEventSessionInput[];
};

export type PetEventSession = { startsAt: Date; endsAt: Date };

export type NormalizedPetEvent = {
  /** Listo para `context.sudo().db.PetEvent.createOne/updateOne`. */
  data: Record<string, unknown>;
  sessions: PetEventSession[];
};

export type NormalizeResult = { ok: true; value: NormalizedPetEvent } | { ok: false; message: string };

const DAY_MS = 24 * 60 * 60 * 1000;
/** Margen para el reloj del navegador: "empieza ahorita" no es "en el pasado". */
const PAST_TOLERANCE_MS = 10 * 60 * 1000;
/** México continental e islas, con margen. */
const MX_BOUNDS = { minLat: 14, maxLat: 33, minLng: -119, maxLng: -86 };

const CATEGORY_VALUES = new Set<string>(PET_EVENT_CATEGORY_OPTIONS.map((option) => option.value));
const SPECIES_VALUES = new Set<string>(PET_EVENT_SPECIES_OPTIONS.map((option) => option.value));
const SCOPE_VALUES = new Set<string>(PET_EVENT_SCOPE_OPTIONS.map((option) => option.value));

function clean(value: string | null | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Igual que `clean`, pero respeta los saltos de línea (descripción, requisitos). */
function cleanMultiline(value: string | null | undefined, max: number): string {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function sessionKey(session: PetEventSession): string {
  return `${session.startsAt.getTime()}-${session.endsAt.getTime()}`;
}

/** Fechas ordenadas y validadas. `existing` = las que ya tenía (editar): esas sí pueden haber pasado. */
export function normalizeSessions(
  raw: PetEventSessionInput[] | null | undefined,
  { existing = [], now = new Date() }: { existing?: PetEventSession[]; now?: Date } = {},
): { ok: true; sessions: PetEventSession[] } | { ok: false; message: string } {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length === 0) return { ok: false, message: "Agrega al menos una fecha." };
  if (list.length > PET_EVENT_LIMITS.MAX_SESSIONS) {
    return { ok: false, message: `Un evento puede tener hasta ${PET_EVENT_LIMITS.MAX_SESSIONS} fechas.` };
  }
  const existingKeys = new Set(existing.map(sessionKey));
  const maxStart = new Date(now);
  maxStart.setMonth(maxStart.getMonth() + PET_EVENT_LIMITS.MAX_MONTHS_AHEAD);

  const sessions: PetEventSession[] = [];
  const seen = new Set<number>();
  for (const item of list) {
    const startsAt = new Date(item?.startsAt);
    const endsAt = new Date(item?.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return { ok: false, message: "Revisa las fechas: hay una que no es válida." };
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      return { ok: false, message: "Cada fecha debe terminar después de empezar." };
    }
    if (endsAt.getTime() - startsAt.getTime() > PET_EVENT_LIMITS.MAX_SESSION_DAYS * DAY_MS) {
      return {
        ok: false,
        message: `Una fecha puede durar hasta ${PET_EVENT_LIMITS.MAX_SESSION_DAYS} días. Si es más, agrega varias fechas.`,
      };
    }
    const session = { startsAt, endsAt };
    if (startsAt.getTime() < now.getTime() - PAST_TOLERANCE_MS && !existingKeys.has(sessionKey(session))) {
      return { ok: false, message: "Hay una fecha que ya pasó. Quítala o cámbiala." };
    }
    if (startsAt.getTime() > maxStart.getTime()) {
      return {
        ok: false,
        message: `Las fechas deben ser dentro de los próximos ${PET_EVENT_LIMITS.MAX_MONTHS_AHEAD} meses.`,
      };
    }
    if (seen.has(startsAt.getTime())) {
      return { ok: false, message: "Hay dos fechas que empiezan a la misma hora." };
    }
    seen.add(startsAt.getTime());
    sessions.push(session);
  }
  sessions.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  if (!sessions.some((session) => session.endsAt.getTime() > now.getTime())) {
    return { ok: false, message: "Todas las fechas ya pasaron. Agrega una próxima." };
  }
  return { ok: true, sessions };
}

function optionalPhone(raw: string | null | undefined, label: string): { ok: true; digits: string } | { ok: false; message: string } {
  const value = (raw ?? "").trim();
  if (!value) return { ok: true, digits: "" };
  const result = normalizeMxPhone(value);
  return result.ok ? { ok: true, digits: result.digits } : { ok: false, message: `${label}: ${result.reason}` };
}

function optionalUrl(
  raw: string | null | undefined,
  label = "El link de registro",
): { ok: true; url: string } | { ok: false; message: string } {
  const value = (raw ?? "").trim();
  if (!value) return { ok: true, url: "" };
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
    if (!url.hostname.includes(".")) throw new Error("host");
    const href = url.toString();
    if (href.length > PET_EVENT_LIMITS.URL_MAX) return { ok: false, message: `${label} es muy largo.` };
    return { ok: true, url: href };
  } catch {
    return { ok: false, message: `${label} no es válido.` };
  }
}

/**
 * Link de una red: acepta el link completo o el usuario («@refugio», «refugio») y devuelve el
 * link. Rechaza links de otro dominio (un link de Instagram en el campo de Facebook).
 */
export function normalizeSocialUrl(
  field: PetEventSocialField,
  raw: string | null | undefined,
): { ok: true; url: string } | { ok: false; message: string } {
  const network = PET_EVENT_SOCIAL_NETWORKS[field];
  const value = (raw ?? "").trim();
  if (!value) return { ok: true, url: "" };
  const handle = value.replace(/^@/, "");
  // Es usuario si empieza con @ o no parece link ("refugio.morelia" es un usuario de Instagram).
  const looksLikeUrl =
    /^https?:\/\//i.test(value) ||
    value.includes("/") ||
    /^www\./i.test(value) ||
    (network.hosts as readonly string[]).some((host) => value.toLowerCase().includes(host));
  if (value.startsWith("@") || !looksLikeUrl) {
    if (!/^[A-Za-z0-9._-]{1,60}$/.test(handle)) return { ok: false, message: `Revisa el usuario de ${network.label}.` };
    return { ok: true, url: `${network.profileBase}${handle}` };
  }
  const parsed = optionalUrl(value, `El link de ${network.label}`);
  if (!parsed.ok) return parsed;
  const host = new URL(parsed.url).hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, "");
  const valid = (network.hosts as readonly string[]).some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  if (!valid) return { ok: false, message: `El link de ${network.label} debe ser de ${network.hosts[0]}.` };
  return { ok: true, url: parsed.url };
}

function optionalInt(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Valida y normaliza el formulario. Llena municipio y estado desde las coordenadas cuando faltan
 * (Nominatim) y deja `stateCode`, `cityKey` y `timeZone` listos para filtros y avisos.
 */
export async function normalizePetEventInput(
  context: KeystoneContext,
  input: PetEventInput,
  {
    isAdmin,
    userId,
    existingSessions = [],
    now = new Date(),
  }: { isAdmin: boolean; userId: string | null; existingSessions?: PetEventSession[]; now?: Date },
): Promise<NormalizeResult> {
  const fail = (message: string): NormalizeResult => ({ ok: false, message });

  const title = clean(input.title, PET_EVENT_LIMITS.TITLE_MAX);
  if (title.length < PET_EVENT_LIMITS.TITLE_MIN) return fail("Escribe un título de al menos 5 letras.");

  const category = (input.category ?? "").trim();
  if (!CATEGORY_VALUES.has(category)) return fail("Elige el tipo de evento.");

  const species = [...new Set((input.species ?? []).filter((value) => SPECIES_VALUES.has(value)))];

  const description = cleanMultiline(input.description, PET_EVENT_LIMITS.DESCRIPTION_MAX);
  if (description.length < PET_EVENT_LIMITS.DESCRIPTION_MIN) {
    return fail("Cuenta un poco más del evento (al menos 20 letras).");
  }
  const requirements = cleanMultiline(input.requirements, PET_EVENT_LIMITS.REQUIREMENTS_MAX);
  const organizerName = clean(input.organizerName, PET_EVENT_LIMITS.ORGANIZER_MAX);

  const contactPhone = optionalPhone(input.contactPhone, "Teléfono de contacto");
  if (!contactPhone.ok) return fail(contactPhone.message);
  const registrationWhatsapp = optionalPhone(input.registrationWhatsapp, "WhatsApp de registro");
  if (!registrationWhatsapp.ok) return fail(registrationWhatsapp.message);
  const registrationUrl = optionalUrl(input.registrationUrl);
  if (!registrationUrl.ok) return fail(registrationUrl.message);
  const social: Record<string, string> = {};
  for (const field of Object.keys(PET_EVENT_SOCIAL_NETWORKS) as PetEventSocialField[]) {
    const result = normalizeSocialUrl(field, input[field]);
    if (!result.ok) return fail(result.message);
    social[field] = result.url;
  }
  const websiteUrl = optionalUrl(input.websiteUrl, "El link del sitio web");
  if (!websiteUrl.ok) return fail(websiteUrl.message);

  // Ubicación
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return fail("Marca en el mapa dónde será el evento.");
  }
  if (lat < MX_BOUNDS.minLat || lat > MX_BOUNDS.maxLat || lng < MX_BOUNDS.minLng || lng > MX_BOUNDS.maxLng) {
    return fail("Por ahora solo publicamos eventos en México.");
  }
  let city = clean(input.city, 120);
  let stateText = clean(input.state, 120);
  let neighborhood = clean(input.neighborhood, 120);
  let address = clean(input.address, 240);
  if (!city || !normalizeStateCode(stateText)) {
    const place = await reverseGeocode(lat, lng);
    if (place) {
      if (!city) city = clean(place.city, 120);
      if (!normalizeStateCode(stateText)) stateText = clean(place.state, 120);
      if (!neighborhood) neighborhood = clean(place.neighborhood, 120);
      if (!address) address = clean(place.address, 240);
    }
  }
  const stateCode = normalizeStateCode(stateText);
  if (!stateCode) {
    return fail("No pudimos reconocer el estado del lugar. Mueve un poco el pin o intenta de nuevo.");
  }
  const placeLabel = clean(input.placeLabel, PET_EVENT_LIMITS.PLACE_LABEL_MAX);

  // Alcance
  const scope = (input.scope ?? "").trim();
  if (!SCOPE_VALUES.has(scope)) return fail("Elige a quién va dirigido el evento.");
  if (scope === PET_EVENT_SCOPE.NATIONAL && !isAdmin) {
    return fail("El alcance nacional solo lo asigna el equipo de Kadesh. Elige estado, municipio o zona.");
  }
  if (scope === PET_EVENT_SCOPE.CITY && !cityKey(city)) {
    return fail("No pudimos reconocer el municipio. Elige el alcance por estado o por zona.");
  }
  const reachInput = optionalInt(input.reachKm);
  const reachKm =
    scope === PET_EVENT_SCOPE.ZONE
      ? (PET_EVENT_REACH_KM_OPTIONS as readonly number[]).includes(reachInput ?? -1)
        ? (reachInput as number)
        : DEFAULT_PET_EVENT_REACH_KM
      : DEFAULT_PET_EVENT_REACH_KM;

  // Costo y cupo
  const isFree = input.isFree !== false;
  const priceNote = clean(input.priceNote, PET_EVENT_LIMITS.PRICE_NOTE_MAX);
  let price: number | null = null;
  if (!isFree) {
    price = optionalInt(input.price);
    if (price !== null && (price < 1 || price > PET_EVENT_LIMITS.PRICE_MAX)) {
      return fail("Revisa el costo: debe ser un número de pesos válido.");
    }
    if (price === null && !priceNote) return fail("Escribe el costo o explica la cuota (p. ej. «donativo voluntario»).");
  }
  const capacity = optionalInt(input.capacity);
  if (capacity !== null && (capacity < 1 || capacity > PET_EVENT_LIMITS.CAPACITY_MAX)) {
    return fail("El cupo debe ser de al menos 1 lugar.");
  }

  const sessions = normalizeSessions(input.sessions, { existing: existingSessions, now });
  if (!sessions.ok) return fail(sessions.message);

  // Veterinaria: solo una que la persona tiene verificada (un admin puede ligar cualquiera).
  let petPlace: Record<string, unknown> | null = null;
  const petPlaceId = (input.petPlaceId ?? "").trim();
  if (petPlaceId) {
    const place = (await context.sudo().query.PetPlace.findOne({
      where: { id: petPlaceId },
      query: "id claimStatus user { id }",
    })) as { id: string; claimStatus?: string | null; user?: { id: string } | null } | null;
    const owns = place && place.user?.id === userId && place.claimStatus === PET_PLACE_CLAIM_STATUS.VERIFIED;
    if (!place || (!isAdmin && !owns)) return fail("Solo puedes ligar una veterinaria verificada que sea tuya.");
    petPlace = { connect: { id: place.id } };
  }

  const state = stateByCode(stateCode);
  return {
    ok: true,
    value: {
      data: {
        title,
        category,
        species,
        description,
        requirements,
        organizerName,
        contactPhone: contactPhone.digits,
        lat,
        lng,
        placeLabel,
        address,
        neighborhood,
        city,
        cityKey: cityKey(city),
        state: state?.name ?? stateText,
        stateCode,
        timeZone: timeZoneForState(stateCode),
        scope,
        reachKm,
        isFree,
        price,
        priceNote: isFree ? "" : priceNote,
        capacity,
        registrationUrl: registrationUrl.url,
        registrationWhatsapp: registrationWhatsapp.digits,
        ...social,
        websiteUrl: websiteUrl.url,
        ...(petPlace ? { petPlace } : {}),
      },
      sessions: sessions.sessions,
    },
  };
}

/** Diferencia entre las fechas guardadas y las nuevas, por inicio y fin exactos. */
export function diffSessions(
  current: Array<PetEventSession & { id: string }>,
  next: PetEventSession[],
): { keepIds: string[]; deleteIds: string[]; create: PetEventSession[] } {
  const nextKeys = new Set(next.map(sessionKey));
  const currentByKey = new Map(current.map((session) => [sessionKey(session), session]));
  return {
    keepIds: current.filter((session) => nextKeys.has(sessionKey(session))).map((session) => session.id),
    deleteIds: current.filter((session) => !nextKeys.has(sessionKey(session))).map((session) => session.id),
    create: next.filter((session) => !currentByKey.has(sessionKey(session))),
  };
}

/** ¿Cambió el lugar? Más de ~50 m o la dirección escrita. */
export function placeChanged(
  before: { lat?: number | null; lng?: number | null; address?: string | null; placeLabel?: string | null },
  after: Record<string, unknown>,
): boolean {
  const moved =
    Math.abs(Number(before.lat ?? 0) - Number(after.lat ?? 0)) > 0.0005 ||
    Math.abs(Number(before.lng ?? 0) - Number(after.lng ?? 0)) > 0.0005;
  return (
    moved ||
    (before.address ?? "") !== (after.address ?? "") ||
    (before.placeLabel ?? "") !== (after.placeLabel ?? "")
  );
}

/** Rutas fijas de la web: `/eventos/nuevo` y las páginas por estado `/eventos/en/<estado>`. */
const RESERVED_SLUGS = new Set(["nuevo", "en"]);

/** Minúsculas, sin acentos, emojis ni signos: "¡Campaña en Morelia!" → "campana-en-morelia". */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "campana-de-esterilizacion-morelia" (sin repetir el municipio si ya viene en el título). */
export function buildPetEventSlug(title: string, city?: string | null): string {
  const titleSlug = slugify(title).slice(0, 60).replace(/-+$/g, "") || "evento";
  const citySlug = slugify(city ?? "").slice(0, 30).replace(/-+$/g, "");
  const slug = citySlug && !titleSlug.includes(citySlug) ? `${titleSlug}-${citySlug}` : titleSlug;
  return RESERVED_SLUGS.has(slug) ? `evento-${slug}` : slug;
}

/** Slug libre: el base, o el base con -2, -3… */
export async function uniquePetEventSlug(context: KeystoneContext, base: string, exceptId?: string): Promise<string> {
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  for (let n = 1; n < 50; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const found = await prisma.petEvent.findFirst({ where: { slug: candidate }, select: { id: true } });
    if (found instanceof Error) throw found;
    if (!found || found.id === exceptId) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Recalcula `firstStartsAt` / `lastEndsAt` desde sus fechas (sin pasar por los hooks del evento). */
export async function recomputePetEventDates(context: KeystoneContext, eventId: string | null | undefined): Promise<void> {
  if (!eventId) return;
  try {
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    const agg = await prisma.petEventSession.aggregate({
      where: { eventId },
      _min: { startsAt: true },
      _max: { endsAt: true },
    });
    if (agg instanceof Error) throw agg;
    const updated = await prisma.petEvent.update({
      where: { id: eventId },
      data: { firstStartsAt: agg._min.startsAt ?? null, lastEndsAt: agg._max.endsAt ?? null },
    });
    if (updated instanceof Error) throw updated;
  } catch (error) {
    console.error("[pet-event] No se pudieron recalcular las fechas:", eventId, error);
  }
}
