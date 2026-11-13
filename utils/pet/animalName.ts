import { foldText } from "./reportSimilarity";

/**
 * Nombre de un animal cuando no se sabe. `Animal.name` va vacío (el `resolveInput` de `Animal`
 * convierte «Sin nombre», «Desconocido», etc.) y para mostrarlo se describe: «Perra café» en títulos,
 * «esta perra» dentro de una frase. Misma regla que `src/components/animals/animalName.ts` de
 * kadesh-landing.
 */

/** Textos de relleno que la gente (o la web vieja) escribe cuando no sabe el nombre. */
const PLACEHOLDERS = new Set([
  "",
  "sin nombre",
  "sin nombre conocido",
  "desconocido",
  "desconocida",
  "nombre desconocido",
  "no se",
  "no lo se",
  "no se su nombre",
  "no tiene nombre",
  "no tiene",
  "ninguno",
  "unknown",
  "unnamed",
  "n a",
  "na",
]);

/** Sin acentos, minúsculas y solo letras y números («N/A» → «n a», «?» → «»). */
const fold = (value: string) => foldText(value);

export function isUnknownAnimalName(name: string | null | undefined): boolean {
  return PLACEHOLDERS.has(fold(name ?? ""));
}

/** Nombre real o cadena vacía. */
export function knownAnimalName(name: string | null | undefined): string {
  return isUnknownAnimalName(name) ? "" : (name ?? "").trim();
}

type Forms = { m: string; f: string; thisM: string; thisF: string };

const FORMS: Record<string, Forms> = {
  dog: { m: "Perro", f: "Perra", thisM: "este perro", thisF: "esta perra" },
  cat: { m: "Gato", f: "Gata", thisM: "este gato", thisF: "esta gata" },
  bird: { m: "Ave", f: "Ave", thisM: "esta ave", thisF: "esta ave" },
  fish: { m: "Pez", f: "Pez", thisM: "este pez", thisF: "este pez" },
  reptil: { m: "Reptil", f: "Reptil", thisM: "este reptil", thisF: "este reptil" },
};
const ALIASES: Record<string, string> = {
  perro: "dog",
  gato: "cat",
  ave: "bird",
  pez: "fish",
  reptile: "reptil",
};
const DEFAULT_FORMS: Forms = { m: "Animal", f: "Animal", thisM: "este animal", thisF: "este animal" };

function formsFor(typeName: string | null | undefined): Forms {
  const key = foldText(typeName ?? "");
  return FORMS[ALIASES[key] ?? key] ?? DEFAULT_FORMS;
}

function shortColor(color: string | null | undefined): string {
  const clean = (color ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return clean && clean.length <= 24 ? clean : "";
}

export type AnimalNameSource = {
  name?: string | null;
  typeName?: string | null;
  sex?: string | null;
  color?: string | null;
};

/** Para títulos y tarjetas: el nombre, o «Perra café». */
export function animalDisplayName(animal: AnimalNameSource): string {
  const known = knownAnimalName(animal.name);
  if (known) return known;
  const forms = formsFor(animal.typeName);
  const base = animal.sex === "female" ? forms.f : forms.m;
  const color = shortColor(animal.color);
  return color ? `${base} ${color}` : base;
}

/** Dentro de una frase: el nombre, o «esta perra» / «este animal». */
export function animalSentenceName(animal: AnimalNameSource): string {
  const known = knownAnimalName(animal.name);
  if (known) return known;
  const forms = formsFor(animal.typeName);
  return animal.sex === "female" ? forms.thisF : forms.thisM;
}

export function capitalizeFirst(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
