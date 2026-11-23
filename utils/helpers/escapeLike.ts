/**
 * Prisma's `contains` / `startsWith` become a Postgres `LIKE` without escaping, so `%` and `_`
 * typed by a person act as wildcards (searching `%` matches everything). Escape them, and the
 * backslash itself, before passing a search term.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
