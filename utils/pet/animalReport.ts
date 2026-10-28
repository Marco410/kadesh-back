import type { KeystoneContext } from "@keystone-6/core/types";
import { normalizeMxPhone } from "./phone";
import { reverseGeocode, type ReversePlace } from "./nominatim";
import { haversineDistance } from "../helpers/calculate_distances";
import {
  SIMILARITY_MAX_RESULTS,
  SIMILARITY_RADIUS_KM,
  SIMILARITY_WINDOW_DAYS,
  kindForStatuses,
  scoreCandidate,
  similarityLevel,
  windowDaysFor,
  type SimilarityKind,
  type SimilarityReason,
} from "./reportSimilarity";

const COLONIA_PREFIX = /^(col\.?|colonia|fracc\.?|fraccionamiento|unidad)\s+/i;
const STREET_LABEL =
  /^(calle|av\.?|avenida|blvd\.?|boulevard|carr\.?|carretera|camino|privada|cerrada|andador|prolongaci[oó]n)\b/i;

/** Lugar del título a partir de lo que escribió la persona, no de la colonia del mapa. */
export function placeLabelFromAddress(address: string) {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^\d{4,6}$/.test(part));
  if (!parts.length) return "";
  const colonia = parts.find((part) => COLONIA_PREFIX.test(part));
  const raw = colonia || parts.find((part) => !STREET_LABEL.test(part)) || parts[0];
  return raw.replace(COLONIA_PREFIX, "").trim();
}

export function petPublicUrl(slug: string) {
  const base = (
    process.env.PET_FRONTEND_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    "https://pet.kadesh.com.mx"
  ).replace(/\/$/, "");
  return `${base}/animales/${slug}`;
}

export type SimilarReport = {
  id: string;
  name: string;
  slug: string | null;
  url: string;
  score: number;
  level: "likely" | "possible";
  kind: SimilarityKind;
  reasons: SimilarityReason[];
  distanceKm: number | null;
  /** Estatus actual (último registro). */
  status: string | null;
  /** Dónde se perdió o se encontró (primer registro). */
  placeLabel: string | null;
  city: string | null;
  /** Fecha en que se perdió o se encontró. */
  reportedAt: string | null;
  coverUrl: string | null;
  reportedBy: string | null;
  /** Solo para avisos del servidor; la query pública no lo expone. */
  userId: string | null;
};

export type SimilarReportsInput = {
  animalTypeId?: string | null;
  name?: string | null;
  phone?: string | null;
  phone2?: string | null;
  sourceUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  status?: string | null;
  sex?: string | null;
  color?: string | null;
  breedId?: string | null;
  description?: string | null;
  lostDate?: string | Date | null;
  excludeAnimalId?: string | null;
  /** Por defecto los dos. */
  kinds?: SimilarityKind[];
};

type CandidateLog = {
  status?: string | null;
  lat?: string | null;
  lng?: string | null;
  city?: string | null;
  placeLabel?: string | null;
  date_status?: string | null;
  createdAt?: string | null;
};

type CandidateRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  sex?: string | null;
  color?: string | null;
  physical_description?: string | null;
  contactNumber?: string | null;
  contactNumber2?: string | null;
  sourceUrl?: string | null;
  reportedBy?: string | null;
  createdAt?: string | null;
  animal_breed?: { id: string; breed?: string | null } | null;
  user?: { id: string } | null;
  multimedia?: Array<{ image?: { url?: string | null } | null }> | null;
  /** Del más nuevo al más viejo. */
  logs?: CandidateLog[] | null;
};

const CANDIDATE_QUERY = `
  id name slug sex color physical_description contactNumber contactNumber2 sourceUrl reportedBy createdAt
  animal_breed { id breed }
  user { id }
  multimedia(orderBy: { order: asc }, take: 1) { image { url } }
  logs(orderBy: { createdAt: desc }) { status lat lng city placeLabel date_status createdAt }
`;

const DAY_MS = 24 * 60 * 60 * 1000;
const KM_PER_DEG_LAT = 111.32;
const NUMERIC_COORD = "^-?[0-9]+(\\.[0-9]+)?$";

function timeOf(value: string | Date | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Animales del mismo tipo con algún registro dentro del radio (lat/lng son texto en `AnimalLog`). */
async function animalIdsNear(
  context: KeystoneContext,
  { lat, lng, typeId, since }: { lat: number; lng: number; typeId: string; since: Date },
): Promise<string[]> {
  const dLat = SIMILARITY_RADIUS_KM / KM_PER_DEG_LAT;
  const dLng =
    SIMILARITY_RADIUS_KM / (KM_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT l."animal" AS id
    FROM "AnimalLog" l
    JOIN "Animal" a ON a.id = l."animal"
    WHERE a."animal_type" = ${typeId}
      AND l."createdAt" >= ${since}
      AND (CASE WHEN l.lat ~ ${NUMERIC_COORD} THEN l.lat::double precision END)
            BETWEEN ${lat - dLat} AND ${lat + dLat}
      AND (CASE WHEN l.lng ~ ${NUMERIC_COORD} THEN l.lng::double precision END)
            BETWEEN ${lng - dLng} AND ${lng + dLng}
    LIMIT 80
  `;
  // Prisma de Keystone devuelve el error en vez de lanzarlo.
  if (rows instanceof Error) throw rows;
  return (rows as Array<{ id: string | null }>).map((row) => row.id).filter(Boolean) as string[];
}

function minDistanceKm(lat: number, lng: number, logs: CandidateLog[]) {
  let best: number | null = null;
  for (const log of logs) {
    const logLat = Number.parseFloat(log.lat ?? "");
    const logLng = Number.parseFloat(log.lng ?? "");
    if (!Number.isFinite(logLat) || !Number.isFinite(logLng)) continue;
    const distance = haversineDistance(lat, lng, logLat, logLng);
    if (best == null || distance < best) best = distance;
  }
  return best;
}

/**
 * Reportes que podrían ser el mismo animal (`duplicate`) o el otro lado de la historia
 * (`match`: perdido con encontrado). Junta candidatos por enlace, teléfono y cercanía, y los
 * califica con `scoreCandidate`. Sin lat/lng ni estatus se comporta como la regla vieja
 * (mismo enlace, o mismo teléfono + nombre parecido).
 */
export async function findSimilarReports(
  context: KeystoneContext,
  input: SimilarReportsInput,
): Promise<SimilarReport[]> {
  const ids = new Set<string>();
  const sourceUrl = input.sourceUrl?.trim() || "";
  const typeId = input.animalTypeId?.trim() || "";
  const phones = [input.phone, input.phone2].map((phone) => phone?.trim() || "").filter(Boolean);
  const kinds = new Set<SimilarityKind>(input.kinds?.length ? input.kinds : ["duplicate", "match"]);
  const since = new Date(Date.now() - SIMILARITY_WINDOW_DAYS.lost * DAY_MS);

  if (sourceUrl) {
    const rows = (await context.sudo().query.Animal.findMany({
      where: { sourceUrl: { equals: sourceUrl } },
      query: "id",
      take: 5,
    })) as Array<{ id: string }>;
    rows.forEach((row) => ids.add(row.id));
  }

  if (phones.length && typeId) {
    const rows = (await context.sudo().query.Animal.findMany({
      where: {
        animal_type: { id: { equals: typeId } },
        createdAt: { gte: since.toISOString() },
        OR: phones.flatMap((phone) => [
          { contactNumber: { equals: phone } },
          { contactNumber2: { equals: phone } },
        ]),
      },
      query: "id",
      take: 30,
    })) as Array<{ id: string }>;
    rows.forEach((row) => ids.add(row.id));
  }

  const lat = Number(input.lat);
  const lng = Number(input.lng);
  const hasPoint =
    input.lat != null && input.lng != null && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  if (hasPoint && typeId) {
    (await animalIdsNear(context, { lat, lng, typeId, since })).forEach((id) => ids.add(id));
  }

  if (input.excludeAnimalId) ids.delete(input.excludeAnimalId);
  if (!ids.size) return [];

  const rows = (await context.sudo().query.Animal.findMany({
    where: { id: { in: [...ids] }, duplicateOf: null },
    query: CANDIDATE_QUERY,
  })) as CandidateRow[];

  const now = Date.now();
  const results: SimilarReport[] = [];
  for (const row of rows) {
    const logs = row.logs ?? [];
    const latest = logs[0];
    const first = logs[logs.length - 1];
    const kind = kindForStatuses(input.status, latest?.status);
    if (!kind || !kinds.has(kind)) continue;

    const sameSource = Boolean(sourceUrl) && row.sourceUrl?.trim() === sourceUrl;
    const lastActivity = timeOf(latest?.createdAt) ?? timeOf(row.createdAt);
    if (!sameSource && lastActivity != null && now - lastActivity > windowDaysFor(latest?.status) * DAY_MS) {
      continue;
    }

    const distanceKm = hasPoint ? minDistanceKm(lat, lng, logs) : null;
    const { score, reasons } = scoreCandidate(
      {
        name: input.name,
        phones,
        sourceUrl,
        sex: input.sex,
        color: input.color,
        breedId: input.breedId,
        description: input.description,
        date: input.lostDate,
      },
      {
        name: row.name,
        phones: [row.contactNumber, row.contactNumber2],
        sourceUrl: row.sourceUrl,
        sex: row.sex,
        color: row.color,
        breedId: row.animal_breed?.id,
        breedName: row.animal_breed?.breed,
        description: row.physical_description,
        date: first?.date_status,
      },
      distanceKm,
    );
    const level = similarityLevel(score);
    if (!level) continue;

    const slug = row.slug?.trim() || row.id;
    results.push({
      id: row.id,
      name: row.name?.trim() || "Sin nombre",
      slug: row.slug ?? null,
      url: petPublicUrl(slug),
      score,
      level,
      kind,
      reasons,
      distanceKm,
      status: latest?.status ?? null,
      placeLabel: first?.placeLabel?.trim() || null,
      city: first?.city?.trim() || null,
      reportedAt: first?.date_status ?? row.createdAt ?? null,
      coverUrl: row.multimedia?.[0]?.image?.url ?? null,
      reportedBy: row.reportedBy ?? null,
      userId: row.user?.id ?? null,
    });
  }

  results.sort(
    (a, b) => b.score - a.score || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
  );
  const perKind = new Map<SimilarityKind, number>();
  return results.filter((report) => {
    const count = perKind.get(report.kind) ?? 0;
    if (count >= SIMILARITY_MAX_RESULTS) return false;
    perKind.set(report.kind, count + 1);
    return true;
  });
}

/**
 * Lo que `createAnimalReport` no deja publicar sin `confirmDuplicate`: el mismo enlace, el mismo
 * teléfono con nombre parecido (la regla de antes) o un parecido «muy probable».
 */
export function isStrongDuplicate(report: SimilarReport) {
  if (report.kind !== "duplicate") return false;
  if (report.level === "likely" || report.reasons.includes("same_source")) return true;
  return (
    report.reasons.includes("same_phone") &&
    (report.reasons.includes("same_name") || report.reasons.includes("similar_name"))
  );
}

export async function fillCityFromCoordinates(input: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  lat?: string | null;
  lng?: string | null;
}): Promise<{
  city: string;
  state: string;
  country: string;
  neighborhood: string;
  postalCode: string;
}> {
  let city = input.city?.trim() || "";
  let state = input.state?.trim() || "";
  let country = input.country?.trim() || "";
  let neighborhood = input.neighborhood?.trim() || "";
  let postalCode = input.postalCode?.trim() || "";
  const lat = Number(input.lat);
  const lng = Number(input.lng);

  if (!city && Number.isFinite(lat) && Number.isFinite(lng)) {
    const place: ReversePlace | null = await reverseGeocode(lat, lng);
    if (place) {
      city = place.city;
      if (!state) state = place.state;
      if (!country) country = place.country;
      if (!neighborhood) neighborhood = place.neighborhood;
      if (!postalCode) postalCode = place.postalCode;
    }
  }

  if (!city) {
    console.warn("[animal-log] ciudad vacía después de geocodificar", {
      lat: input.lat,
      lng: input.lng,
    });
    city = state || "Sin especificar";
  }

  return { city, state, country, neighborhood, postalCode };
}

export function requirePhone(raw: string | null | undefined, label = "teléfono") {
  const value = raw?.trim() || "";
  if (!value) {
    throw new Error(`Escribe el ${label}.`);
  }
  const phone = normalizeMxPhone(value);
  if (!phone.ok) {
    console.error("[animal] teléfono inválido", { label, raw: value });
    throw new Error(phone.reason);
  }
  return phone.digits;
}

export function optionalPhone(raw: string | null | undefined) {
  const value = raw?.trim() || "";
  if (!value) return "";
  const phone = normalizeMxPhone(value);
  if (!phone.ok) {
    console.error("[animal] segundo teléfono inválido", { raw: value });
    throw new Error(phone.reason);
  }
  return phone.digits;
}
