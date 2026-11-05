/**
 * Los 32 estados de México con su clave INEGI, un slug para URLs (`?estado=michoacan`) y la zona
 * horaria en la que se muestran las fechas de un evento. Nominatim devuelve el estado como texto
 * libre ("México", "Coahuila de Zaragoza", "CDMX"…): `normalizeStateCode` lo lleva a la clave.
 *
 * El front de Kadesh Pet (`kadesh-landing/src/components/events/mexicoStates.ts`) tiene una copia:
 * si cambias algo aquí, cámbialo allá.
 */

export type MexicoState = {
  /** Clave INEGI de dos dígitos ("16"). */
  code: string;
  slug: string;
  name: string;
  /** Zona horaria IANA en la que se muestran las fechas de los eventos del estado. */
  timeZone: string;
  /** Otras formas en que llega el nombre (ya sin acentos ni mayúsculas). */
  aliases: string[];
};

export const MEXICO_STATES: readonly MexicoState[] = [
  { code: "01", slug: "aguascalientes", name: "Aguascalientes", timeZone: "America/Mexico_City", aliases: ["ags"] },
  { code: "02", slug: "baja-california", name: "Baja California", timeZone: "America/Tijuana", aliases: ["bc", "baja california norte"] },
  { code: "03", slug: "baja-california-sur", name: "Baja California Sur", timeZone: "America/Mazatlan", aliases: ["bcs"] },
  { code: "04", slug: "campeche", name: "Campeche", timeZone: "America/Merida", aliases: [] },
  { code: "05", slug: "coahuila", name: "Coahuila", timeZone: "America/Monterrey", aliases: ["coahuila de zaragoza"] },
  { code: "06", slug: "colima", name: "Colima", timeZone: "America/Mexico_City", aliases: [] },
  { code: "07", slug: "chiapas", name: "Chiapas", timeZone: "America/Mexico_City", aliases: [] },
  { code: "08", slug: "chihuahua", name: "Chihuahua", timeZone: "America/Chihuahua", aliases: [] },
  {
    code: "09",
    slug: "ciudad-de-mexico",
    name: "Ciudad de México",
    timeZone: "America/Mexico_City",
    aliases: ["cdmx", "distrito federal", "df", "mexico city", "ciudad de mexico"],
  },
  { code: "10", slug: "durango", name: "Durango", timeZone: "America/Monterrey", aliases: [] },
  { code: "11", slug: "guanajuato", name: "Guanajuato", timeZone: "America/Mexico_City", aliases: ["gto"] },
  { code: "12", slug: "guerrero", name: "Guerrero", timeZone: "America/Mexico_City", aliases: [] },
  { code: "13", slug: "hidalgo", name: "Hidalgo", timeZone: "America/Mexico_City", aliases: [] },
  { code: "14", slug: "jalisco", name: "Jalisco", timeZone: "America/Mexico_City", aliases: ["jal"] },
  {
    code: "15",
    slug: "estado-de-mexico",
    name: "Estado de México",
    timeZone: "America/Mexico_City",
    aliases: ["mexico", "edomex", "edo mex", "estado de mexico", "state of mexico"],
  },
  { code: "16", slug: "michoacan", name: "Michoacán", timeZone: "America/Mexico_City", aliases: ["michoacan de ocampo", "mich"] },
  { code: "17", slug: "morelos", name: "Morelos", timeZone: "America/Mexico_City", aliases: [] },
  { code: "18", slug: "nayarit", name: "Nayarit", timeZone: "America/Mazatlan", aliases: [] },
  { code: "19", slug: "nuevo-leon", name: "Nuevo León", timeZone: "America/Monterrey", aliases: ["nl"] },
  { code: "20", slug: "oaxaca", name: "Oaxaca", timeZone: "America/Mexico_City", aliases: [] },
  { code: "21", slug: "puebla", name: "Puebla", timeZone: "America/Mexico_City", aliases: [] },
  { code: "22", slug: "queretaro", name: "Querétaro", timeZone: "America/Mexico_City", aliases: ["queretaro de arteaga", "qro"] },
  { code: "23", slug: "quintana-roo", name: "Quintana Roo", timeZone: "America/Cancun", aliases: ["q roo", "qroo"] },
  { code: "24", slug: "san-luis-potosi", name: "San Luis Potosí", timeZone: "America/Mexico_City", aliases: ["slp"] },
  { code: "25", slug: "sinaloa", name: "Sinaloa", timeZone: "America/Mazatlan", aliases: [] },
  { code: "26", slug: "sonora", name: "Sonora", timeZone: "America/Hermosillo", aliases: [] },
  { code: "27", slug: "tabasco", name: "Tabasco", timeZone: "America/Mexico_City", aliases: [] },
  { code: "28", slug: "tamaulipas", name: "Tamaulipas", timeZone: "America/Monterrey", aliases: [] },
  { code: "29", slug: "tlaxcala", name: "Tlaxcala", timeZone: "America/Mexico_City", aliases: [] },
  {
    code: "30",
    slug: "veracruz",
    name: "Veracruz",
    timeZone: "America/Mexico_City",
    aliases: ["veracruz de ignacio de la llave", "ver"],
  },
  { code: "31", slug: "yucatan", name: "Yucatán", timeZone: "America/Merida", aliases: ["yuc"] },
  { code: "32", slug: "zacatecas", name: "Zacatecas", timeZone: "America/Mexico_City", aliases: ["zac"] },
];

/** Zona horaria cuando no sabemos el estado. */
export const DEFAULT_TIME_ZONE = "America/Mexico_City";

/** Minúsculas, sin acentos ni signos, espacios simples: "Michoacán de Ocampo" → "michoacan de ocampo". */
function plain(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_KEY = new Map<string, MexicoState>();
for (const state of MEXICO_STATES) {
  BY_KEY.set(plain(state.name), state);
  BY_KEY.set(plain(state.slug.replace(/-/g, " ")), state);
  for (const alias of state.aliases) BY_KEY.set(plain(alias), state);
}

const BY_CODE = new Map(MEXICO_STATES.map((state) => [state.code, state]));
const BY_SLUG = new Map(MEXICO_STATES.map((state) => [state.slug, state]));

/**
 * Clave INEGI del estado a partir del texto libre (Nominatim, formulario) o `null` si no se
 * reconoce. "Estado de Michoacán", "Michoacán de Ocampo" y "michoacan" dan "16".
 */
export function normalizeStateCode(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const key = plain(text);
  if (BY_CODE.has(key.padStart(2, "0")) && /^\d{1,2}$/.test(key)) return key.padStart(2, "0");
  const direct = BY_KEY.get(key);
  if (direct) return direct.code;
  // "Estado de Jalisco" → "jalisco" (pero "Estado de México" ya está en los alias).
  const withoutPrefix = key.replace(/^(estado libre y soberano de|estado de|edo de|edo)\s+/, "");
  return BY_KEY.get(withoutPrefix)?.code ?? null;
}

export function stateByCode(code: string | null | undefined): MexicoState | null {
  return code ? BY_CODE.get(code) ?? null : null;
}

export function stateBySlug(slug: string | null | undefined): MexicoState | null {
  return slug ? BY_SLUG.get(slug.trim().toLowerCase()) ?? null : null;
}

export function timeZoneForState(code: string | null | undefined): string {
  return stateByCode(code)?.timeZone ?? DEFAULT_TIME_ZONE;
}

/**
 * Llave para comparar municipios: "Municipio de Morelia" y "morelia" dan "morelia". Se usa en
 * filtros (`?ciudad=morelia`) y para cruzar eventos con la zona de alertas de cada persona.
 */
export function cityKey(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const key = plain(text)
    .replace(/^municipio de\s+/, "")
    .replace(/\s+/g, "-");
  return key || null;
}
