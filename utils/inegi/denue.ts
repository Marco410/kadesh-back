import { inegiFetch } from "./throttle";
import type {
  DenueEstablishment,
  SearchByAreaActivityParams,
  SearchByLocationParams,
} from "./types";

const DENUE_BASE = "https://www.inegi.org.mx/app/api/denue/v1/consulta";
const MAX_RADIUS_METERS = 5000;
const PAGE_SIZE_CAP = 1000;

function denueToken(): string {
  const token = process.env.INEGI_DENUE_TOKEN?.trim();
  if (!token) {
    throw new Error("INEGI_DENUE_TOKEN no configurada");
  }
  return token;
}

/**
 * Condición de path DENUE: sin acentos (IIS 404 con %C3%A9),
 * palabras separadas por coma (docs INEGI), cada token encodeURIComponent.
 */
export function encodeDenueCondition(value: string, fallback: string): string {
  const ascii = (value.trim() || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const parts = ascii.split(/[\s,]+/).filter(Boolean);
  const words = parts.length ? parts : [fallback];
  return words.map((word) => encodeURIComponent(word)).join(",");
}

function isDenueEmptyBody(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return true;
  return (
    trimmed.includes("no hay resultados") ||
    trimmed.includes("sin resultados") ||
    trimmed === "null"
  );
}

async function parseDenueList(res: Response): Promise<DenueEstablishment[]> {
  const text = await res.text();
  if (isDenueEmptyBody(text)) return [];
  if (!res.ok) {
    throw new Error(`INEGI DENUE HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `INEGI DENUE devolvió una respuesta no JSON: ${text.slice(0, 200)}`,
    );
  }
  if (!Array.isArray(data)) {
    throw new Error("INEGI DENUE no devolvió una lista de establecimientos");
  }
  return data as DenueEstablishment[];
}

/**
 * Buscar por punto. Docs: `/Buscar/{condicion}/{lat},{lng}/{metros}/{token}`
 * Radio máx. 5000 m. Keyword vacío = "todos".
 */
export async function searchByLocation(
  params: SearchByLocationParams,
): Promise<DenueEstablishment[]> {
  const token = denueToken();
  const radius = Math.min(
    Math.max(Math.floor(params.radiusMeters), 1),
    MAX_RADIUS_METERS,
  );
  const condition = encodeDenueCondition(params.keyword ?? "", "todos");
  const url = `${DENUE_BASE}/Buscar/${condition}/${params.lat},${params.lng}/${radius}/${token}`;
  const res = await inegiFetch(url);
  return parseDenueList(res);
}

/**
 * BuscarAreaAct. Niveles geográficos o SCIAN no usados van como 0.
 * `start`/`end` son 1-indexados; INEGI limita ~1000 filas por llamada.
 * Nombre vacío = 0 (todos), no "todos" (eso es el método Buscar).
 * El path termina con Id=0 antes del token.
 */
export async function searchByAreaActivity(
  params: SearchByAreaActivityParams,
): Promise<DenueEstablishment[]> {
  const token = denueToken();
  const start = Math.max(1, Math.floor(params.start));
  const end = Math.min(
    Math.max(start, Math.floor(params.end)),
    start + PAGE_SIZE_CAP - 1,
  );
  const scian = (params.scianCode ?? "").replace(/\D/g, "");
  const sector = scian.slice(0, 2) || "0";
  const subsector = scian.slice(0, 3) || "0";
  const rama = scian.slice(0, 4) || "0";
  const clase = scian.slice(0, 6) || "0";
  const name = params.keyword?.trim()
    ? encodeDenueCondition(params.keyword, "0")
    : "0";

  const url = [
    DENUE_BASE,
    "BuscarAreaAct",
    params.stateCode || "0",
    params.municipalityCode || "0",
    params.localityCode || "0",
    "0",
    "0",
    sector,
    subsector,
    rama,
    clase,
    name,
    String(start),
    String(end),
    "0",
    token,
  ].join("/");

  const res = await inegiFetch(url);
  return parseDenueList(res);
}

/** Ficha por Id numérico que devuelve DENUE (no es el CLEE). */
export async function getById(id: string): Promise<DenueEstablishment | null> {
  const token = denueToken();
  const url = `${DENUE_BASE}/Ficha/${encodeURIComponent(id.trim())}/${token}`;
  const res = await inegiFetch(url);
  const rows = await parseDenueList(res);
  return rows[0] ?? null;
}

/** Busca el CLEE como nombre a nivel nacional (página de 1). */
export async function getByClee(
  clee: string,
): Promise<DenueEstablishment | null> {
  const rows = await searchByAreaActivity({
    stateCode: "0",
    keyword: clee.trim(),
    start: 1,
    end: 5,
  });
  const match = rows.find(
    (row) => String(row.CLEE ?? "").toUpperCase() === clee.trim().toUpperCase(),
  );
  return match ?? rows[0] ?? null;
}

export const DENUE_MAX_RADIUS_METERS = MAX_RADIUS_METERS;
export const DENUE_PAGE_SIZE_CAP = PAGE_SIZE_CAP;
