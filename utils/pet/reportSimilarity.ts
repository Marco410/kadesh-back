/**
 * Parecido entre dos reportes de animal: funciones puras (sin BD) para que los pesos se puedan
 * ajustar y probar sin tocar las consultas. `findSimilarReports` (`animalReport.ts`) junta los
 * candidatos y llama a `scoreCandidate` con cada uno.
 */

/** Desde aquí se muestra como «posible» reporte repetido. */
export const SIMILARITY_POSSIBLE = 45;
/** Desde aquí es «muy probable»: `createAnimalReport` lo bloquea salvo `confirmDuplicate`. */
export const SIMILARITY_LIKELY = 70;
/** Radio en el que se buscan candidatos por ubicación. */
export const SIMILARITY_RADIUS_KM = 5;
/** Un perdido se sigue buscando meses; un encontrado se resuelve antes. */
export const SIMILARITY_WINDOW_DAYS = { lost: 90, other: 30 } as const;
/** Máximo de resultados por tipo (`duplicate` y `match`). */
export const SIMILARITY_MAX_RESULTS = 3;

const WEIGHTS = {
  SAME_SOURCE: 100,
  SAME_PHONE: 40,
  SAME_NAME: 35,
  SIMILAR_NAME: 25,
  DIFFERENT_NAME: -20,
  VERY_CLOSE: 25,
  CLOSE: 20,
  NEAR: 12,
  AREA: 5,
  SAME_SEX: 5,
  DIFFERENT_SEX: -30,
  SAME_COLOR: 10,
  DIFFERENT_COLOR: -5,
  SAME_BREED: 5,
  SAME_MIXED_BREED: 2,
  SIMILAR_DESCRIPTION: 10,
  SAME_DATE: 5,
} as const;

export type SimilarityReason =
  | "same_source"
  | "same_phone"
  | "same_name"
  | "similar_name"
  | "very_close"
  | "close"
  | "same_sex"
  | "same_color"
  | "same_breed"
  | "similar_description"
  | "same_date";

/** Estatus abiertos: se busca a la familia (`lost`) o al animal le falta casa (`STREET`). */
const LOST_STATUSES = ["lost"];
const STREET_STATUSES = ["found", "rescued", "abandoned"];
/** Ya no se busca: no cuentan como candidatos. */
export const CLOSED_STATUSES = new Set(["in_family", "adopted"]);

export type SimilarityKind = "duplicate" | "match";

/**
 * `duplicate`: el mismo animal reportado otra vez (perdido con perdido).
 * `match`: el otro lado de la historia (perdido con encontrado), alguien podría reunirlos.
 * Sin estatus (clientes viejos) todo cuenta como `duplicate`.
 */
export function kindForStatuses(
  newStatus: string | null | undefined,
  candidateStatus: string | null | undefined,
): SimilarityKind | null {
  const candidate = (candidateStatus ?? "").toLowerCase();
  if (CLOSED_STATUSES.has(candidate)) return null;
  const status = (newStatus ?? "").toLowerCase();
  if (!status) return "duplicate";
  if (LOST_STATUSES.includes(status)) {
    if (LOST_STATUSES.includes(candidate)) return "duplicate";
    if (STREET_STATUSES.includes(candidate)) return "match";
    return null;
  }
  if (STREET_STATUSES.includes(status)) {
    if (STREET_STATUSES.includes(candidate)) return "duplicate";
    if (LOST_STATUSES.includes(candidate)) return "match";
    return null;
  }
  return status === candidate ? "duplicate" : null;
}

export function windowDaysFor(status: string | null | undefined) {
  return (status ?? "").toLowerCase() === "lost"
    ? SIMILARITY_WINDOW_DAYS.lost
    : SIMILARITY_WINDOW_DAYS.other;
}

export function foldText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nombres que no identifican a nadie: «Sin nombre», «Perrito», «No sé». */
const GENERIC_NAMES = new Set([
  "",
  "sin nombre",
  "sinnombre",
  "s n",
  "n a",
  "na",
  "no se",
  "no lo se",
  "desconocido",
  "desconocida",
  "unnamed",
  "perro",
  "perra",
  "perrito",
  "perrita",
  "gato",
  "gata",
  "gatito",
  "gatita",
  "cachorro",
  "cachorra",
  "cachorrito",
  "cachorrita",
  "callejero",
  "callejera",
  "callejerito",
  "callejerita",
  "ave",
  "pajaro",
  "pajarito",
  "conejo",
  "conejito",
  "mascota",
]);

export function isGenericName(name: string | null | undefined) {
  const folded = foldText(name);
  return GENERIC_NAMES.has(folded) || folded.startsWith("sin nombre");
}

export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/** `same` (igual tras quitar acentos y mayúsculas), `similar` (contenido o un error de dedo), o nada. */
export function compareNames(
  a: string | null | undefined,
  b: string | null | undefined,
): "same" | "similar" | "different" | null {
  if (isGenericName(a) || isGenericName(b)) return null;
  const left = foldText(a);
  const right = foldText(b);
  if (left === right) return "same";
  const shorter = Math.min(left.length, right.length);
  if (shorter >= 3 && (left.includes(right) || right.includes(left))) return "similar";
  if (shorter >= 4) {
    const allowed = shorter >= 7 ? 2 : 1;
    if (levenshtein(left, right) <= allowed) return "similar";
  }
  return "different";
}

/** Palabra de color → color base. Femenino y plural se resuelven en `colorOf`. */
const COLOR_WORDS: Record<string, string> = {
  blanco: "blanco",
  hueso: "blanco",
  albino: "blanco",
  negro: "negro",
  azabache: "negro",
  cafe: "cafe",
  marron: "cafe",
  chocolate: "cafe",
  canela: "cafe",
  cobrizo: "cafe",
  gris: "gris",
  plateado: "gris",
  plata: "gris",
  cenizo: "gris",
  azul: "gris",
  dorado: "dorado",
  amarillo: "dorado",
  beige: "dorado",
  crema: "dorado",
  rubio: "dorado",
  miel: "dorado",
  arena: "dorado",
  naranja: "naranja",
  anaranjado: "naranja",
  rojizo: "naranja",
  pelirrojo: "naranja",
  atigrado: "atigrado",
  rayado: "atigrado",
  tabby: "atigrado",
  barcino: "atigrado",
  manchas: "manchas",
  mancha: "manchas",
  manchado: "manchas",
  pinto: "manchas",
  moteado: "manchas",
  dalmata: "manchas",
  tricolor: "tricolor",
  calico: "tricolor",
  carey: "tricolor",
};

function colorOf(word: string) {
  const candidates = [word, word.replace(/(es|s)$/, "")];
  for (const value of candidates) {
    if (COLOR_WORDS[value]) return COLOR_WORDS[value];
    if (value.endsWith("a") && COLOR_WORDS[`${value.slice(0, -1)}o`]) {
      return COLOR_WORDS[`${value.slice(0, -1)}o`];
    }
  }
  return null;
}

export function colorTokens(value: string | null | undefined) {
  const tokens = new Set<string>();
  for (const word of foldText(value).split(" ")) {
    const color = word ? colorOf(word) : null;
    if (color) tokens.add(color);
  }
  return tokens;
}

/** Palabras de 4 letras o más que no dicen nada del animal. */
const STOPWORDS = new Set([
  "tiene",
  "tenia",
  "como",
  "esta",
  "este",
  "estos",
  "estas",
  "para",
  "pero",
  "cuando",
  "donde",
  "porque",
  "sobre",
  "entre",
  "hasta",
  "desde",
  "mucho",
  "mucha",
  "poco",
  "poca",
  "todo",
  "toda",
  "todos",
  "todas",
  "tambien",
  "solo",
  "ella",
  "ellos",
  "nombre",
  "responde",
  "perro",
  "perra",
  "perrito",
  "perrita",
  "gato",
  "gata",
  "gatito",
  "gatita",
  "color",
  "mascota",
  "informacion",
  "favor",
  "perdio",
  "perdido",
  "perdida",
  "visto",
  "vista",
  "cualquier",
  "ayuda",
  "ayudanos",
  "llamar",
  "numero",
  "telefono",
  "contacto",
  "recompensa",
  "ofrece",
  "gracias",
]);

export function descriptionTokens(value: string | null | undefined) {
  const tokens = new Set<string>();
  for (const word of foldText(value).split(" ")) {
    if (word.length >= 4 && !STOPWORDS.has(word)) tokens.add(word);
  }
  return tokens;
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

const MIXED_BREED = /mestiz|crioll|sin raza|no se|desconoc/i;

export type SimilarityFields = {
  name?: string | null;
  phones?: Array<string | null | undefined>;
  sourceUrl?: string | null;
  sex?: string | null;
  color?: string | null;
  breedId?: string | null;
  breedName?: string | null;
  description?: string | null;
  /** Fecha en que se perdió o se encontró. */
  date?: string | Date | null;
};

export type SimilarityScore = { score: number; reasons: SimilarityReason[] };

function distancePoints(distanceKm: number | null | undefined): [number, SimilarityReason | null] {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return [0, null];
  if (distanceKm <= 0.5) return [WEIGHTS.VERY_CLOSE, "very_close"];
  if (distanceKm <= 1.5) return [WEIGHTS.CLOSE, "close"];
  if (distanceKm <= 3) return [WEIGHTS.NEAR, "close"];
  if (distanceKm <= SIMILARITY_RADIUS_KM) return [WEIGHTS.AREA, null];
  return [0, null];
}

function toTime(value: string | Date | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Puntaje de 0 a 100 y las razones que lo explican (las que suman, de mayor a menor peso). */
export function scoreCandidate(
  input: SimilarityFields,
  candidate: SimilarityFields,
  distanceKm: number | null,
): SimilarityScore {
  const gains: Array<[number, SimilarityReason]> = [];
  let score = 0;
  const add = (points: number, reason?: SimilarityReason | null) => {
    score += points;
    if (reason && points > 0) gains.push([points, reason]);
  };

  const source = input.sourceUrl?.trim();
  if (source && source === candidate.sourceUrl?.trim()) {
    return { score: WEIGHTS.SAME_SOURCE, reasons: ["same_source"] };
  }

  const inputPhones = new Set((input.phones ?? []).map((phone) => phone?.trim()).filter(Boolean));
  if ((candidate.phones ?? []).some((phone) => phone?.trim() && inputPhones.has(phone.trim()))) {
    add(WEIGHTS.SAME_PHONE, "same_phone");
  }

  const names = compareNames(input.name, candidate.name);
  if (names === "same") add(WEIGHTS.SAME_NAME, "same_name");
  else if (names === "similar") add(WEIGHTS.SIMILAR_NAME, "similar_name");
  else if (names === "different") add(WEIGHTS.DIFFERENT_NAME);

  const [distance, distanceReason] = distancePoints(distanceKm);
  add(distance, distanceReason);

  const sexes = ["male", "female"];
  if (sexes.includes(input.sex ?? "") && sexes.includes(candidate.sex ?? "")) {
    if (input.sex === candidate.sex) add(WEIGHTS.SAME_SEX, "same_sex");
    else add(WEIGHTS.DIFFERENT_SEX);
  }

  const inputColors = colorTokens(input.color);
  const candidateColors = colorTokens(candidate.color);
  if (inputColors.size && candidateColors.size) {
    let shared = 0;
    for (const color of inputColors) if (candidateColors.has(color)) shared += 1;
    const overlap = shared / Math.min(inputColors.size, candidateColors.size);
    if (overlap >= 0.5) add(WEIGHTS.SAME_COLOR, "same_color");
    else if (shared === 0) add(WEIGHTS.DIFFERENT_COLOR);
  }

  if (input.breedId && input.breedId === candidate.breedId) {
    add(
      MIXED_BREED.test(candidate.breedName ?? "") ? WEIGHTS.SAME_MIXED_BREED : WEIGHTS.SAME_BREED,
      "same_breed",
    );
  }

  if (jaccard(descriptionTokens(input.description), descriptionTokens(candidate.description)) >= 0.3) {
    add(WEIGHTS.SIMILAR_DESCRIPTION, "similar_description");
  }

  const inputDate = toTime(input.date);
  const candidateDate = toTime(candidate.date);
  if (inputDate != null && candidateDate != null) {
    if (Math.abs(inputDate - candidateDate) <= 7 * 24 * 60 * 60 * 1000) {
      add(WEIGHTS.SAME_DATE, "same_date");
    }
  }

  const reasons = gains.sort((a, b) => b[0] - a[0]).map(([, reason]) => reason);
  return {
    score: Math.max(0, Math.min(100, score)),
    reasons: [...new Set(reasons)],
  };
}

export function similarityLevel(score: number): "likely" | "possible" | null {
  if (score >= SIMILARITY_LIKELY) return "likely";
  if (score >= SIMILARITY_POSSIBLE) return "possible";
  return null;
}
