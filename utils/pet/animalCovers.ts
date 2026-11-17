import type { KeystoneContext } from "@keystone-6/core/types";

/**
 * Una foto de portada por animal (la de menor `order`), para listas que solo pintan una: pines del
 * mapa y reencuentros de la portada. Dos consultas en total, no una por animal: primero los ids de
 * las portadas con SQL (`DISTINCT ON`) y luego solo esas fotos por Keystone, que firma la URL.
 */
export async function getAnimalCoverUrls(ids: string[], context: KeystoneContext): Promise<Map<string, string>> {
  const covers = new Map<string, string>();
  if (ids.length === 0) return covers;
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  const firsts = await prisma.$queryRaw`
    SELECT DISTINCT ON (m."animal") m.id
    FROM "AnimalMultimedia" m
    WHERE m."animal" = ANY(${ids}::text[])
    ORDER BY m."animal", m."order" ASC, m."createdAt" ASC NULLS LAST
  `;
  // Prisma de Keystone devuelve el error en vez de lanzarlo: sin portadas, la lista sigue.
  if (firsts instanceof Error) {
    console.error("[animalCovers]", firsts);
    return covers;
  }
  const mediaIds = (firsts as Array<{ id: string }>).map((row) => row.id);
  if (mediaIds.length === 0) return covers;
  const media = (await context.sudo().query.AnimalMultimedia.findMany({
    where: { id: { in: mediaIds } },
    query: "image { url } animal { id }",
  })) as Array<{ image?: { url?: string | null } | null; animal?: { id: string } | null }>;
  for (const item of media) {
    if (item.animal?.id && item.image?.url) covers.set(item.animal.id, item.image.url);
  }
  return covers;
}
