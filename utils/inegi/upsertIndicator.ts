import { KeystoneContext } from "@keystone-6/core/types";
import {
  getIndicator,
  indicatorCacheKey,
  mapIndicatorResponse,
} from "./indicadores";
import { findCatalogIndicator } from "./indicatorCatalog";
import type { MappedIndicator } from "./types";

function getPrisma(context: KeystoneContext): {
  techInegiEstablishment: any;
  techInegiEconomicActivity: any;
  techInegiIndicator: any;
  techInegiGeoBoundary: any;
} {
  return (context as unknown as { prisma: any }).prisma;
}

export { getPrisma };

export async function upsertMappedIndicator(
  context: KeystoneContext,
  mapped: MappedIndicator,
): Promise<"created" | "updated"> {
  const existing = await context.sudo().query.TechInegiIndicator.findOne({
    where: { cacheKey: mapped.cacheKey },
    query: "id",
  });

  const data = {
    indicatorId: mapped.indicatorId,
    indicatorName: mapped.indicatorName,
    geographicLevel: mapped.geographicLevel,
    geographicCode: mapped.geographicCode,
    period: mapped.period,
    value: mapped.value,
    unit: mapped.unit,
    fetchedAt: new Date().toISOString(),
  };

  if (existing) {
    await context.sudo().query.TechInegiIndicator.updateOne({
      where: { id: existing.id },
      data,
    });
    return "updated";
  }

  await context.sudo().query.TechInegiIndicator.createOne({
    data: { cacheKey: mapped.cacheKey, ...data },
  });
  return "created";
}

export async function fetchAndCacheIndicator(
  context: KeystoneContext,
  indicatorId: string,
  geographicCode: string,
  recent = true,
): Promise<{ mapped: MappedIndicator[]; created: number; updated: number }> {
  const catalog = findCatalogIndicator(indicatorId);
  const payload = await getIndicator(indicatorId, geographicCode, recent);
  const mapped = mapIndicatorResponse(
    indicatorId,
    geographicCode,
    payload,
    catalog?.name,
  );

  let created = 0;
  let updated = 0;
  for (const row of mapped) {
    const result = await upsertMappedIndicator(context, row);
    if (result === "created") created += 1;
    else updated += 1;
  }

  return { mapped, created, updated };
}

export function previewCacheKey(
  indicatorId: string,
  geographicCode: string,
  period = "latest",
): string {
  return indicatorCacheKey(indicatorId, geographicCode, period);
}
