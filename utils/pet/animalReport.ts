import type { KeystoneContext } from "@keystone-6/core/types";
import { normalizeMxPhone } from "./phone";
import { reverseGeocode, type ReversePlace } from "./nominatim";

const COLONIA_PREFIX = /^(col\.?|colonia|fracc\.?|fraccionamiento|unidad)\s+/i;
const STREET_LABEL =
  /^(calle|av\.?|avenida|blvd\.?|boulevard|carr\.?|carretera|camino|privada|cerrada|andador|prolongaci[oó]n)\b/i;

export function foldName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function namesSimilar(a: string, b: string) {
  const left = foldName(a);
  const right = foldName(b);
  if (!left || !right || left.length < 2 || right.length < 2) return false;
  return left === right || left.includes(right) || right.includes(left);
}

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

export type ReportDuplicate = {
  id: string;
  name: string;
  slug: string | null;
  url: string;
};

type AnimalRow = { id: string; name?: string | null; slug?: string | null };

function toDuplicate(row: AnimalRow): ReportDuplicate | null {
  if (!row.id) return null;
  const slug = row.slug?.trim() || row.id;
  return {
    id: row.id,
    name: row.name?.trim() || "Sin nombre",
    slug: row.slug ?? null,
    url: petPublicUrl(slug),
  };
}

export async function findReportDuplicates(
  context: KeystoneContext,
  input: {
    sourceUrl?: string | null;
    phone?: string | null;
    animalTypeId?: string | null;
    name?: string | null;
  },
): Promise<ReportDuplicate[]> {
  const found = new Map<string, ReportDuplicate>();
  const sourceUrl = input.sourceUrl?.trim();
  if (sourceUrl) {
    const rows = (await context.sudo().query.Animal.findMany({
      where: { sourceUrl: { equals: sourceUrl } },
      query: "id name slug",
      take: 5,
    })) as AnimalRow[];
    for (const row of rows) {
      const dup = toDuplicate(row);
      if (dup) found.set(dup.id, dup);
    }
  }

  const phone = input.phone?.trim();
  const typeId = input.animalTypeId?.trim();
  const name = input.name?.trim();
  if (phone && typeId && name) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const rows = (await context.sudo().query.Animal.findMany({
      where: {
        contactNumber: { equals: phone },
        animal_type: { id: { equals: typeId } },
        createdAt: { gte: since },
      },
      query: "id name slug",
      take: 30,
    })) as AnimalRow[];
    for (const row of rows) {
      if (!namesSimilar(name, row.name || "")) continue;
      const dup = toDuplicate(row);
      if (dup) found.set(dup.id, dup);
    }
  }

  return [...found.values()];
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
