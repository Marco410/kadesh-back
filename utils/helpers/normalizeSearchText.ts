/**
 * Texto para buscar sin distinguir mayúsculas ni acentos: minúsculas, sin diacríticos
 * (á → a, ü → u, ñ → n) y con los espacios seguidos reducidos a uno.
 *
 * El front aplica esta misma función al término de búsqueda antes de mandarlo. Si cambia
 * aquí, hay que cambiarla allá y volver a correr `pnpm leads:backfill-search-names --apply`.
 */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
