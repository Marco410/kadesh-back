import type { KeystoneContext } from "@keystone-6/core/types";

/**
 * Impacto público de cada organización: animales publicados a su nombre, cuántos ya tienen hogar y
 * cuántos están en adopción. El estado de un animal es su registro más reciente en la bitácora
 * (igual que `petLandingStats`). Los reportes unidos a otro (`duplicateOf`) no cuentan.
 */

export type RescueImpact = { animals: number; adopted: number; inAdoption: number };

/** Estados finales de un animal que ya tiene hogar (ver ANIMAL_LOGS_OPTIONS). */
const HOME_STATUSES = ["adopted", "in_family"];

export const EMPTY_IMPACT: RescueImpact = { animals: 0, adopted: 0, inAdoption: 0 };

export async function rescueImpactByOrg(
  context: KeystoneContext,
  organizationIds: string[],
): Promise<Map<string, RescueImpact>> {
  const result = new Map<string, RescueImpact>();
  const ids = [...new Set(organizationIds.filter(Boolean))];
  if (!ids.length) return result;
  try {
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    const rows = await prisma.$queryRaw`
      SELECT a."organization" AS org,
        COUNT(*)::int AS animals,
        COUNT(*) FILTER (WHERE latest.status = ANY(${HOME_STATUSES}))::int AS adopted,
        COUNT(*) FILTER (WHERE latest.status = 'in_adoption')::int AS "inAdoption"
      FROM "Animal" a
      LEFT JOIN (
        SELECT DISTINCT ON (l."animal") l."animal", l.status
        FROM "AnimalLog" l
        WHERE l."animal" IN (SELECT id FROM "Animal" WHERE "organization" = ANY(${ids}))
        ORDER BY l."animal", l."date_status" DESC NULLS LAST, l."createdAt" DESC NULLS LAST
      ) latest ON latest."animal" = a.id
      WHERE a."organization" = ANY(${ids}) AND a."duplicateOf" IS NULL
      GROUP BY a."organization"
    `;
    if (rows instanceof Error) throw rows;
    for (const row of rows as Array<{ org: string; animals: number; adopted: number; inAdoption: number }>) {
      result.set(row.org, {
        animals: Number(row.animals) || 0,
        adopted: Number(row.adopted) || 0,
        inAdoption: Number(row.inAdoption) || 0,
      });
    }
  } catch (error) {
    console.error("[rescue] No se pudo calcular el impacto de las organizaciones", error);
  }
  return result;
}
