/** Solo dígitos, y solo los últimos 10: la parte que identifica a una persona sin importar si
 * el teléfono se guardó con +52, espacios, guiones o paréntesis. */
export function phoneTail(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(-10);
}

/** ¿Es el mismo teléfono? Compara la cola de dígitos; acepta que uno venga sin lada. Exige un
 * mínimo de 8 dígitos para no juntar a dos personas por un número corto. */
export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const x = phoneTail(a);
  const y = phoneTail(b);
  if (x.length < 8 || y.length < 8) return false;
  return x.length >= y.length ? x.endsWith(y) : y.endsWith(x);
}

/**
 * Busca a quién pertenece un teléfono entrante. Los teléfonos de los leads son texto libre
 * ("55 1234 5678", "(55) 1234-5678", "+52 1 55…", los que trae Google Maps), así que un
 * `contains` de los 10 dígitos corridos casi nunca los encuentra y la respuesta de un cliente
 * quedaba sin conversación.
 *
 * Como Keystone no puede normalizar en la consulta, se preselecciona con un fragmento corto
 * que sí suele quedar corrido (los últimos 4 dígitos; si no aparece, los últimos 2, que
 * sobreviven a formatos como "55-12-34-56-78") y se compara ya normalizado en memoria.
 *
 * Si algún día esto pesa (empresas con decenas de miles de leads), la salida es guardar un
 * `phoneDigits` indexado en el lead en vez de preseleccionar aquí.
 */
export async function findByPhone<T extends { phone?: string | null }>(
  rawPhone: string,
  search: (fragment: string, take: number) => Promise<readonly T[]>,
): Promise<T | null> {
  const tail = phoneTail(rawPhone);
  if (tail.length < 8) return null;

  const tiers: Array<[fragment: string, take: number]> = [
    [tail.slice(-4), 100],
    [tail.slice(-2), 1000],
  ];

  for (const [fragment, take] of tiers) {
    const candidates = await search(fragment, take);
    const hit = candidates.find((c) => phonesMatch(c.phone, tail));
    if (hit) return hit;
  }
  return null;
}
