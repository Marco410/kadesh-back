import type { KeystoneContext } from "@keystone-6/core/types";
import { foldText, isGenericName } from "../../../utils/pet/reportSimilarity";

/**
 * Texto del post de un animal en la Página de Facebook de Kadesh Pet. Junta todo lo que hay del
 * reporte (estatus, tipo, raza, sexo, edad, color, tamaño, dónde y cuándo, señas y notas) con
 * emojis del tipo de animal y del estatus, y cierra con qué hacer y hashtags. No lleva teléfono:
 * el contacto está en la ficha, que es el enlace del post.
 */

export const FACEBOOK_POST_QUERY = `
  id name slug physical_description age color size sex
  animal_type { name }
  animal_breed { breed }
  logs(orderBy: [{ date_status: desc }, { createdAt: desc }]) {
    status date_status placeLabel neighborhood city state notes
  }
`;

export type PostLog = {
  status?: string | null;
  date_status?: string | null;
  placeLabel?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
};

export type AnimalPostData = {
  name?: string | null;
  physical_description?: string | null;
  age?: string | null;
  color?: string | null;
  size?: string | null;
  sex?: string | null;
  animal_type?: { name?: string | null } | null;
  animal_breed?: { breed?: string | null } | null;
  /** Del más reciente al más viejo. */
  logs?: PostLog[] | null;
};

export type Gender = "m" | "f";

export type TypeInfo = {
  emoji: string;
  label: string;
  /** «este perrito» / «esta perrita». */
  little: Record<Gender, string>;
  hashtag: string;
};

const TYPES: Record<string, TypeInfo> = {
  dog: { emoji: "🐶", label: "Perro", little: { m: "este perrito", f: "esta perrita" }, hashtag: "Perro" },
  cat: { emoji: "🐱", label: "Gato", little: { m: "este gatito", f: "esta gatita" }, hashtag: "Gato" },
  bird: { emoji: "🐦", label: "Ave", little: { m: "esta ave", f: "esta ave" }, hashtag: "Ave" },
  fish: { emoji: "🐠", label: "Pez", little: { m: "este pez", f: "este pez" }, hashtag: "Mascota" },
  reptil: { emoji: "🦎", label: "Reptil", little: { m: "este reptil", f: "este reptil" }, hashtag: "Mascota" },
  mammal: { emoji: "🐹", label: "Mamífero", little: { m: "este animalito", f: "esta animalita" }, hashtag: "Mascota" },
};

const DEFAULT_TYPE: TypeInfo = {
  emoji: "🐾",
  label: "",
  little: { m: "este animalito", f: "esta animalita" },
  hashtag: "Mascota",
};

const TYPE_ALIASES: Record<string, string> = { perro: "dog", gato: "cat", ave: "bird", pez: "fish", mamifero: "mammal" };

export function typeInfo(name?: string | null): TypeInfo {
  const key = foldText(name);
  return TYPES[TYPE_ALIASES[key] ?? key] ?? DEFAULT_TYPE;
}

/** Emoji de la línea de raza: el del perro o gato que más se parece. */
function breedEmoji(type: string, breed: string, color: string): string {
  const b = foldText(breed);
  const c = foldText(color);
  if (type === "dog") {
    if (/poodle|caniche/.test(b)) return "🐩";
    if (/husky|malamute|lobo/.test(b)) return "🐺";
    if (/pastor|labrador|golden|retriever/.test(b)) return "🐕‍🦺";
    return "🐕";
  }
  if (type === "cat") return /negr/.test(c) ? "🐈‍⬛" : "🐈";
  return typeInfo(type).emoji;
}

export function gender(sex?: string | null): Gender {
  return sex === "female" ? "f" : "m";
}

/** «o»/«a» según el sexo: `g(sex, "Lo", "La")`. Sin sexo conocido, masculino genérico. */
export function g(sex: string | null | undefined, m: string, f: string) {
  return gender(sex) === "f" ? f : m;
}

type StatusCopy = {
  header: (sex?: string | null) => string;
  intro: (who: string, sex?: string | null) => string;
  placeLabel?: (sex?: string | null) => string;
  dateLabel?: (sex?: string | null) => string;
  cta: (sex?: string | null) => string[];
  hashtags: (type: TypeInfo) => string[];
};

const STATUS_COPY: Record<string, StatusCopy> = {
  lost: {
    header: () => "🆘 ¡SE BUSCA!",
    intro: (who) => `¡Ayúdanos a encontrar a ${who}! 🙏`,
    placeLabel: () => "Se perdió en",
    dateLabel: () => "Se perdió el",
    cta: (sex) => [
      `👀 ¿${g(sex, "Lo", "La")} has visto? Entra al enlace para avisarle a su familia.`,
      "🔁 Comparte: puede estar cerca de ti o de alguien que conoces.",
    ],
    hashtags: (type) => [`${type.hashtag}Perdido`, "MascotaPerdida", "SeBusca"],
  },
  found: {
    header: (sex) => `📢 ¡${g(sex, "ENCONTRADO", "ENCONTRADA")}!`,
    intro: (who, sex) => `${capitalize(who)} fue ${g(sex, "encontrado", "encontrada")} y busca a su familia. 🏠`,
    placeLabel: (sex) => `${g(sex, "Lo", "La")} encontraron en`,
    dateLabel: (sex) => `${g(sex, "Encontrado", "Encontrada")} el`,
    cta: (sex) => [
      `🏠 ¿Es tuy${g(sex, "o", "a")} o conoces a su familia? Entra al enlace para contactar.`,
      "🔁 Comparte para que llegue a su familia.",
    ],
    hashtags: (type) => [`${type.hashtag}Encontrado`, "MascotaEncontrada"],
  },
  in_adoption: {
    header: () => "🏡 ¡EN ADOPCIÓN! 💕",
    intro: (who) => `${capitalize(who)} busca un hogar lleno de amor. 🥰`,
    placeLabel: () => "Está en",
    cta: (sex) => [
      `💌 ¿Le das un hogar? Entra al enlace para conocer${g(sex, "lo", "la")}.`,
      "🔁 Comparte: alguien de tus contactos puede ser su familia.",
    ],
    hashtags: (type) => ["AdoptaNoCompres", `${type.hashtag}EnAdopcion`],
  },
  abandoned: {
    header: () => "⚠️ ¡NECESITA AYUDA!",
    intro: (who, sex) => `${capitalize(who)} fue ${g(sex, "abandonado", "abandonada")} y necesita una mano. 🙏`,
    placeLabel: (sex) => `${g(sex, "Lo", "La")} vieron en`,
    dateLabel: () => "Visto el",
    cta: () => ["🙏 ¿Puedes ayudar o sabes algo? Entra al enlace.", "🔁 Comparte para que llegue a quien pueda ayudar."],
    hashtags: (type) => [`${type.hashtag}Abandonado`, "RescateAnimal"],
  },
  rescued: {
    header: (sex) => `🙌 ¡${g(sex, "RESCATADO", "RESCATADA")}!`,
    intro: (who, sex) => `${capitalize(who)} fue ${g(sex, "rescatado", "rescatada")} y ya está a salvo. 💛`,
    placeLabel: (sex) => `${g(sex, "Lo", "La")} rescataron en`,
    dateLabel: (sex) => `${g(sex, "Rescatado", "Rescatada")} el`,
    cta: (sex) => [`💛 ¿${g(sex, "Lo", "La")} reconoces o quieres ayudar? Entra al enlace.`],
    hashtags: () => ["RescateAnimal"],
  },
  adopted: {
    header: (sex) => `🎉 ¡${g(sex, "ADOPTADO", "ADOPTADA")}!`,
    intro: (who) => `${capitalize(who)} ya encontró un hogar. 💕`,
    cta: () => ["🙏 Gracias a todos los que compartieron."],
    hashtags: () => ["AdoptaNoCompres", "FinalFeliz"],
  },
  in_family: {
    header: () => "🏠 ¡YA ESTÁ EN CASA! 🎉",
    intro: (who) => `${capitalize(who)} volvió con su familia. 💕`,
    cta: () => ["🙏 Gracias a todos los que compartieron."],
    hashtags: () => ["FinalFeliz"],
  },
};

/** Etiquetas de «dónde» y «cuándo» según el estatus: «Se perdió en», «La encontraron el»… */
export function statusPlaceDateLabels(
  status: string | null | undefined,
  sex?: string | null,
): { place: string; date: string } {
  const copy = STATUS_COPY[(status ?? "").trim().toLowerCase()];
  return {
    place: copy?.placeLabel?.(sex) ?? "Dónde",
    date: copy?.dateLabel?.(sex) ?? "Fecha",
  };
}

export function capitalize(text: string) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function clean(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** «Arcos de Guadalupe, Zapopan, Jalisco» sin repetir partes que ya vienen en `placeLabel`. */
export function placeOf(log?: PostLog | null) {
  if (!log) return "";
  const parts: string[] = [];
  for (const raw of [log.placeLabel || log.neighborhood, log.city, log.state]) {
    const part = clean(raw);
    if (!part || /^sin especificar$/i.test(part)) continue;
    const folded = foldText(part);
    if (parts.some((existing) => foldText(existing).includes(folded))) continue;
    parts.push(part);
  }
  return parts.join(", ");
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Mexico_City",
});
const DATE_FORMAT_YEAR = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

export function dateOf(value?: string | null, now = new Date()) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const sameYear = date.getFullYear() === now.getFullYear();
  // «martes, 20 de octubre» → «martes 20 de octubre».
  return (sameYear ? DATE_FORMAT : DATE_FORMAT_YEAR).format(date).replace(",", "");
}

/** «Ciudad de México» → «CiudadDeMéxico». */
function hashtagOf(text: string) {
  const words = clean(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
  return words.join("");
}

const DEFAULT_NOTES = /^sin informaci[oó]n adicional\.?$/i;
export const NO_BREED = /^(sin asignar|no se|no sé|desconocid[ao])$/i;

export function buildAnimalFacebookMessage(animal: AnimalPostData, now = new Date()): string {
  const typeKey = TYPE_ALIASES[foldText(animal.animal_type?.name)] ?? foldText(animal.animal_type?.name);
  const type = typeInfo(animal.animal_type?.name);
  const sex = animal.sex;
  const latest = animal.logs?.[0] ?? null;
  const status = clean(latest?.status).toLowerCase();
  const copy = STATUS_COPY[status];

  const name = clean(animal.name);
  const named = Boolean(name) && !isGenericName(name);
  const who = named ? name : type.little[gender(sex)];

  const lines: string[] = [];
  if (copy) {
    lines.push(`${copy.header(sex)} ${type.emoji}`);
    lines.push(copy.intro(who, sex));
  } else {
    lines.push(`${type.emoji} ${named ? name : capitalize(type.little[gender(sex)])}`);
  }

  const facts: string[] = [];
  const breed = clean(animal.animal_breed?.breed);
  const sexLabel = sex === "male" ? "Macho ♂️" : sex === "female" ? "Hembra ♀️" : "";
  const identity = [type.label, breed && !NO_BREED.test(breed) ? breed : "", sexLabel].filter(Boolean);
  if (identity.length) facts.push(`${breedEmoji(typeKey, breed, clean(animal.color))} ${identity.join(" · ")}`);
  if (clean(animal.age)) facts.push(`🎂 Edad: ${clean(animal.age)}`);
  if (clean(animal.color)) facts.push(`🎨 Color: ${clean(animal.color)}`);
  if (clean(animal.size)) facts.push(`📏 Tamaño: ${clean(animal.size)}`);
  if (facts.length) lines.push("", ...facts);

  // Dónde y cuándo: el registro más reciente; si no trae lugar, el primero (donde se reportó).
  const place = placeOf(latest) || placeOf(animal.logs?.[animal.logs.length - 1]);
  const when = copy?.dateLabel ? dateOf(latest?.date_status, now) : "";
  const whereWhen: string[] = [];
  if (place) whereWhen.push(`📍 ${copy?.placeLabel ? `${copy.placeLabel(sex)}: ` : ""}${place}`);
  if (when) whereWhen.push(`📅 ${copy!.dateLabel!(sex)}: ${when}`);
  if (whereWhen.length) lines.push("", ...whereWhen);

  const description = clean(animal.physical_description);
  const notes = clean(latest?.notes);
  const extra: string[] = [];
  if (description) extra.push(`📝 ${description}`);
  if (notes && !DEFAULT_NOTES.test(notes) && foldText(notes) !== foldText(description)) extra.push(`💬 ${notes}`);
  if (extra.length) lines.push("", ...extra);

  lines.push("", ...(copy ? copy.cta(sex) : ["👉 Toda la información en el enlace."]));

  const city = clean(latest?.city);
  const hashtags = [
    ...(copy ? copy.hashtags(type) : []),
    city && !/^sin especificar$/i.test(city) ? hashtagOf(city) : "",
    "KadeshPet",
  ].filter(Boolean);
  lines.push("", [...new Set(hashtags)].map((tag) => `#${tag}`).join(" "));

  return lines.join("\n");
}

/** Lee el animal y arma el texto del post. null si el animal ya no existe. */
export async function loadAnimalFacebookMessage(
  context: KeystoneContext,
  animalId: string,
): Promise<{ slug: string | null; message: string } | null> {
  const animal = (await context.sudo().query.Animal.findOne({
    where: { id: animalId },
    query: FACEBOOK_POST_QUERY,
  })) as (AnimalPostData & { slug?: string | null }) | null;
  if (!animal) return null;
  return { slug: animal.slug ?? null, message: buildAnimalFacebookMessage(animal) };
}
