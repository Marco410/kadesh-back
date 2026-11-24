import type { KeystoneContext } from "@keystone-6/core/types";
import { invalidateActiveAds } from "../../../utils/pet/ads";
import {
  AD_GEO_SCOPE,
  AD_KIND,
  AD_PLACEMENTS,
  AD_RADIUS_KM,
  AD_TEXT_LIMITS,
  isAdTone,
  type AdKind,
} from "./constants";

type HookArgs = {
  operation: string;
  resolvedData: Record<string, any>;
  item?: Record<string, any> | null;
  context: KeystoneContext;
  addValidationError: (message: string) => void;
};

const TEXT_FIELDS = ["title", "body", "brandLabel", "ctaLabel", "url", "zoneLabel", "advertiserName", "advertiserContact"] as const;

/** Which relationship each kind points to; `null` means it uses `url`. */
const TARGET_BY_KIND: Record<AdKind, "storeProduct" | "petPlace" | "animal" | null> = {
  [AD_KIND.HOUSE]: null,
  [AD_KIND.BRAND]: null,
  [AD_KIND.STORE_PRODUCT]: "storeProduct",
  [AD_KIND.PET_PLACE]: "petPlace",
  [AD_KIND.ANIMAL]: "animal",
};
const TARGET_FIELDS = ["storeProduct", "petPlace", "animal"] as const;

const TARGET_LABEL: Record<(typeof TARGET_FIELDS)[number], string> = {
  storeProduct: "un producto de la tienda",
  petPlace: "una veterinaria o negocio",
  animal: "un animal",
};

const TEXT_LABEL: Record<keyof typeof AD_TEXT_LIMITS, string> = {
  title: "El título",
  body: "La descripción",
  brandLabel: "La marca",
  ctaLabel: "El botón",
};

export function adResolveInput({ resolvedData }: HookArgs) {
  const data = { ...resolvedData };
  for (const field of TEXT_FIELDS) {
    if (typeof data[field] === "string") data[field] = data[field].trim();
  }
  if (typeof data.tone === "string") {
    const tone = data.tone.trim().toLowerCase();
    // `#abc` → `#aabbcc`, and a color typed without `#`.
    const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(tone);
    data.tone = short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : /^[0-9a-f]{6}$/.test(tone) ? `#${tone}` : tone;
  }
  if (Array.isArray(data.placements)) {
    data.placements = AD_PLACEMENTS.filter((placement) => data.placements.includes(placement));
  }
  return data;
}

/** Value after this change: the new one if it is in the change, otherwise the stored one. */
function next(field: string, resolvedData: Record<string, any>, item?: Record<string, any> | null) {
  return resolvedData[field] !== undefined ? resolvedData[field] : item?.[field];
}

/** Whether a relationship is set after this change (`{ connect }`, `{ disconnect }` or the stored id). */
function hasTarget(field: string, resolvedData: Record<string, any>, item?: Record<string, any> | null): boolean {
  const change = resolvedData[field];
  if (change?.connect?.id) return true;
  if (change?.disconnect) return false;
  return Boolean(item?.[`${field}Id`]);
}

/** `https://…` or a path of the site (`/tienda/…`). */
export function isAdUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function toDay(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
}

export function adValidateInput({ resolvedData, item, addValidationError }: HookArgs) {
  const kind = next("kind", resolvedData, item) as AdKind;

  for (const [field, max] of Object.entries(AD_TEXT_LIMITS)) {
    const value = next(field, resolvedData, item);
    if (typeof value === "string" && value.length > max) {
      addValidationError(`${TEXT_LABEL[field as keyof typeof AD_TEXT_LIMITS]} admite hasta ${max} caracteres para que quepa en la tarjeta.`);
    }
  }
  if (!String(next("title", resolvedData, item) ?? "").trim()) addValidationError("Falta el título.");
  if (resolvedData.tone !== undefined && !isAdTone(resolvedData.tone)) {
    addValidationError("El color debe ser uno de la lista o un hexadecimal como #1f8a70.");
  }

  const target = TARGET_BY_KIND[kind];
  if (target === null) {
    if (!isAdUrl(next("url", resolvedData, item))) {
      addValidationError("Este tipo de anuncio necesita un enlace https://… o una ruta del sitio (/…).");
    }
  } else if (target && !hasTarget(target, resolvedData, item)) {
    addValidationError(`Elige ${TARGET_LABEL[target]} como destino del anuncio.`);
  }
  for (const field of TARGET_FIELDS) {
    if (field !== target && hasTarget(field, resolvedData, item)) {
      addValidationError(`Un anuncio de este tipo no lleva ${TARGET_LABEL[field]}: quítalo.`);
    }
  }

  const placements = next("placements", resolvedData, item);
  if (!Array.isArray(placements) || placements.length === 0) {
    addValidationError("Elige al menos un lugar donde mostrar el anuncio.");
  }

  const start = toDay(next("startDate", resolvedData, item));
  const end = toDay(next("endDate", resolvedData, item));
  if (start && end && end < start) addValidationError("La fecha de fin es anterior a la de inicio.");

  if (next("geoScope", resolvedData, item) === AD_GEO_SCOPE.RADIUS) {
    const lat = next("lat", resolvedData, item);
    const lng = next("lng", resolvedData, item);
    const radius = next("radiusKm", resolvedData, item);
    if (typeof lat !== "number" || lat < -90 || lat > 90 || typeof lng !== "number" || lng < -180 || lng > 180) {
      addValidationError("Un anuncio por zona necesita la latitud y longitud del centro.");
    }
    if (typeof radius !== "number" || radius < AD_RADIUS_KM.MIN || radius > AD_RADIUS_KM.MAX) {
      addValidationError(`El radio va de ${AD_RADIUS_KM.MIN} a ${AD_RADIUS_KM.MAX} km.`);
    }
  }
}

/** Any change shows up in `activeAds` right away instead of after the cache runs out. */
export function adAfterOperation() {
  invalidateActiveAds();
}
