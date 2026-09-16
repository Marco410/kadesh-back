import { KeystoneContext } from "@keystone-6/core/types";
import type { MappedEstablishment } from "./types";

const ACTIVITY_QUERY = "id scianCode name";

export async function getOrCreateEconomicActivity(
  context: KeystoneContext,
  scianCode: string,
  name: string | null,
): Promise<{ id: string } | null> {
  const code = scianCode.trim();
  if (!code) return null;

  const existing = await context.sudo().query.TechInegiEconomicActivity.findOne({
    where: { scianCode: code },
    query: ACTIVITY_QUERY,
  });
  if (existing) return { id: existing.id };

  try {
    const created = await context.sudo().query.TechInegiEconomicActivity.createOne({
      data: {
        scianCode: code,
        name: (name ?? code).trim() || code,
      },
      query: "id",
    });
    return { id: created.id };
  } catch {
    const raced = await context.sudo().query.TechInegiEconomicActivity.findOne({
      where: { scianCode: code },
      query: "id",
    });
    return raced ? { id: raced.id } : null;
  }
}

export type UpsertEstablishmentResult = "created" | "updated";

export async function upsertEstablishment(
  context: KeystoneContext,
  mapped: MappedEstablishment,
): Promise<UpsertEstablishmentResult> {
  const activity =
    mapped.scianCode != null
      ? await getOrCreateEconomicActivity(
          context,
          mapped.scianCode,
          mapped.scianName,
        )
      : null;

  const data: Record<string, unknown> = {
    name: mapped.name,
    legalName: mapped.legalName,
    employeeStratum: mapped.employeeStratum,
    street: mapped.street,
    exteriorNumber: mapped.exteriorNumber,
    interiorNumber: mapped.interiorNumber,
    neighborhood: mapped.neighborhood,
    postalCode: mapped.postalCode,
    locality: mapped.locality,
    municipality: mapped.municipality,
    state: mapped.state,
    phone: mapped.phone,
    email: mapped.email,
    website: mapped.website,
    lat: mapped.lat,
    lng: mapped.lng,
    rawPayload: mapped.rawPayload,
    lastSyncedAt: new Date().toISOString(),
  };

  if (activity) {
    data.economicActivity = { connect: { id: activity.id } };
  }

  const existing = await context.sudo().query.TechInegiEstablishment.findOne({
    where: { clee: mapped.clee },
    query: "id",
  });

  if (existing) {
    await context.sudo().query.TechInegiEstablishment.updateOne({
      where: { id: existing.id },
      data,
    });
    return "updated";
  }

  await context.sudo().query.TechInegiEstablishment.createOne({
    data: {
      clee: mapped.clee,
      ...data,
    },
  });
  return "created";
}
