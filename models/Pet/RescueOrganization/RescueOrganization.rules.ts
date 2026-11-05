import type { KeystoneContext } from "@keystone-6/core/types";
import { normalizeSocialUrl } from "../PetEvent/PetEvent.rules";
import { normalizeMxPhone } from "../../../utils/pet/phone";
import { ANIMAL_TYPE_OPTIONS } from "../../../utils/constants/constants";
import { RESCUE_ORG_LIMITS, RESCUE_ORG_TYPE_OPTIONS, RESCUE_RESERVED_SLUGS } from "./constants";

/**
 * Reglas del perfil de una organización: limpieza y validación de lo que manda el formulario.
 * Las usan los hooks de la list (crear y editar desde la web o el admin) y `activateRescueOrganization`.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPE_VALUES = new Set(RESCUE_ORG_TYPE_OPTIONS.map((option) => option.value));
const SPECIES_VALUES = new Set<string>(ANIMAL_TYPE_OPTIONS.map((option) => option.value));

/** Una línea: sin espacios repetidos. */
function cleanLine(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Texto largo: respeta saltos de línea, sin más de una línea vacía seguida. */
function cleanText(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function optionalUrl(raw: unknown, label: string): { ok: true; url: string } | { ok: false; message: string } {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: true, url: "" };
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
    if (!url.hostname.includes(".")) throw new Error("host");
    const href = url.toString();
    if (href.length > RESCUE_ORG_LIMITS.URL_MAX) return { ok: false, message: `${label} es muy largo.` };
    return { ok: true, url: href };
  } catch {
    return { ok: false, message: `${label} no es válido.` };
  }
}

/**
 * Limpia los campos del perfil que vengan en `data` (los demás no se tocan) y junta los errores.
 * Es idempotente: pasarle datos ya limpios no los cambia.
 */
export function normalizeRescueOrgProfile(data: Record<string, any>): {
  data: Record<string, any>;
  errors: string[];
} {
  const next = { ...data };
  const errors: string[] = [];

  if ("name" in next) {
    next.name = cleanLine(next.name, RESCUE_ORG_LIMITS.NAME_MAX);
    if (next.name.length < RESCUE_ORG_LIMITS.NAME_MIN) {
      errors.push(`El nombre debe tener al menos ${RESCUE_ORG_LIMITS.NAME_MIN} letras.`);
    }
  }
  if ("type" in next && next.type != null && !TYPE_VALUES.has(next.type)) {
    errors.push("Elige qué tipo de espacio de rescate eres.");
  }
  if ("description" in next) next.description = cleanText(next.description, RESCUE_ORG_LIMITS.DESCRIPTION_MAX);
  if ("needs" in next) next.needs = cleanText(next.needs, RESCUE_ORG_LIMITS.NEEDS_MAX);
  if ("donationInfo" in next) next.donationInfo = cleanText(next.donationInfo, RESCUE_ORG_LIMITS.DONATION_INFO_MAX);
  if ("statusNote" in next) next.statusNote = cleanText(next.statusNote, RESCUE_ORG_LIMITS.STATUS_NOTE_MAX);
  if ("city" in next) next.city = cleanLine(next.city, RESCUE_ORG_LIMITS.CITY_MAX);
  if ("state" in next) next.state = cleanLine(next.state, RESCUE_ORG_LIMITS.CITY_MAX);

  if ("species" in next && next.species != null) {
    const list = Array.isArray(next.species) ? next.species : [];
    next.species = [...new Set(list.filter((value: unknown) => SPECIES_VALUES.has(String(value))))];
  }

  if ("whatsapp" in next && next.whatsapp != null) {
    const raw = String(next.whatsapp).trim();
    if (!raw) next.whatsapp = "";
    else {
      const phone = normalizeMxPhone(raw);
      if (phone.ok) next.whatsapp = phone.digits;
      else errors.push(`WhatsApp: ${phone.reason}`);
    }
  }

  if ("email" in next && next.email != null) {
    next.email = String(next.email).trim().toLowerCase().slice(0, 200);
    if (next.email && !EMAIL_PATTERN.test(next.email)) errors.push("Revisa el correo de contacto.");
  }

  for (const [field, label] of [
    ["websiteUrl", "El link del sitio web"],
    ["donationUrl", "El link para donar"],
  ] as const) {
    if (!(field in next) || next[field] == null) continue;
    const result = optionalUrl(next[field], label);
    if (result.ok) next[field] = result.url;
    else errors.push(result.message);
  }

  for (const field of ["facebookUrl", "instagramUrl", "tiktokUrl"] as const) {
    if (!(field in next) || next[field] == null) continue;
    const result = normalizeSocialUrl(field, next[field]);
    if (result.ok) next[field] = result.url;
    else errors.push(result.message);
  }

  if ("capacity" in next && next.capacity != null) {
    const n = Math.round(Number(next.capacity));
    if (!Number.isFinite(n) || n < 0 || n > RESCUE_ORG_LIMITS.CAPACITY_MAX) {
      errors.push("Revisa la capacidad.");
    } else next.capacity = n;
  }

  return { data: next, errors };
}

/** Minúsculas, sin acentos, emojis ni signos: "¡Huellitas A.C.!" → "huellitas-ac". */
export function slugifyRescue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildRescueSlug(name: string, city?: string | null): string {
  const base = slugifyRescue(name).slice(0, 60).replace(/-+$/g, "") || "rescate";
  const citySlug = slugifyRescue(city ?? "").slice(0, 30).replace(/-+$/g, "");
  const slug = citySlug && !base.includes(citySlug) ? `${base}-${citySlug}` : base;
  return RESCUE_RESERVED_SLUGS.has(slug) ? `rescate-${slug}` : slug;
}

/** Slug libre: el base, o el base con -2, -3… */
export async function uniqueRescueSlug(context: KeystoneContext, base: string, exceptId?: string): Promise<string> {
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  for (let n = 1; n < 50; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const found = await prisma.rescueOrganization.findFirst({ where: { slug: candidate }, select: { id: true } });
    if (found instanceof Error) throw found;
    if (!found || found.id === exceptId) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
