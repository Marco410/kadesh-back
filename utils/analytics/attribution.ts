/**
 * De dónde llegó una cuenta (primer contacto): parámetros UTM, sitio que la refirió y página de
 * entrada. Lo junta el front en la primera visita y lo manda al registrarse.
 *
 * Solo se guardan llaves conocidas y textos cortos. Del referrer se guarda el dominio, no la URL
 * completa: la query de otra página puede traer datos de la persona.
 */

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const MAX_TEXT = 200;
const MAX_PATH = 300;

export type SignupAttribution = Partial<Record<(typeof UTM_KEYS)[number], string>> & {
  referrer?: string;
  landingPath?: string;
  firstSeenAt?: string;
};

function text(value: unknown, max = MAX_TEXT): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function hostOf(value: unknown): string | undefined {
  const raw = text(value, 500);
  if (!raw) return undefined;
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.toLowerCase() || undefined;
  } catch {
    return undefined;
  }
}

/** Ruta sin query ni hash (la query puede traer datos personales). */
function pathOf(value: unknown): string | undefined {
  const raw = text(value, MAX_PATH);
  if (!raw || !raw.startsWith("/")) return undefined;
  return raw.split(/[?#]/)[0] || undefined;
}

export function cleanAttribution(input: unknown): SignupAttribution | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const out: SignupAttribution = {};
  for (const key of UTM_KEYS) {
    const value = text(source[key]);
    if (value) out[key] = value.toLowerCase();
  }
  const referrer = hostOf(source.referrer);
  if (referrer) out.referrer = referrer;
  const landingPath = pathOf(source.landingPath);
  if (landingPath) out.landingPath = landingPath;
  const firstSeen = text(source.firstSeenAt, 40);
  if (firstSeen && !Number.isNaN(new Date(firstSeen).getTime())) out.firstSeenAt = firstSeen;
  return Object.keys(out).length ? out : null;
}

/** Canal legible: la campaña si hay UTM, si no el sitio que refirió, si no "Directo". */
export function attributionChannel(attribution: SignupAttribution | null | undefined): string {
  if (!attribution) return "Sin dato";
  if (attribution.utm_source) return attribution.utm_source;
  if (attribution.referrer) return attribution.referrer.replace(/^www\./, "");
  return "Directo";
}
