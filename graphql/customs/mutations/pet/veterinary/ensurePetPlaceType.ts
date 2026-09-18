import { KeystoneContext } from "@keystone-6/core/types";
import { TYPES_PET_SHELTER } from "../../../../../utils/constants/constants";

export type PetPlaceTypeRow = { id: string; value: string };

/**
 * Busca el tipo por `value` y, si el catálogo lo admite pero no está en BD,
 * lo crea. El seed viejo no rellenaba tipos nuevos si ya había alguno.
 */
export async function ensurePetPlaceType(
  context: KeystoneContext,
  value: string,
): Promise<PetPlaceTypeRow | null> {
  const sudo = context.sudo();
  const existing = (await sudo.query.PetPlaceType.findOne({
    where: { value },
    query: "id value",
  })) as PetPlaceTypeRow | null;
  if (existing) return existing;

  const typeData = TYPES_PET_SHELTER.find((type) => type.value === value);
  if (!typeData) return null;

  try {
    return (await sudo.query.PetPlaceType.createOne({
      data: {
        label: typeData.label,
        value: typeData.value,
        plural: typeData.plural,
      },
      query: "id value",
    })) as PetPlaceTypeRow;
  } catch {
    const raced = (await sudo.query.PetPlaceType.findOne({
      where: { value },
      query: "id value",
    })) as PetPlaceTypeRow | null;
    return raced;
  }
}

export async function ensurePetPlaceTypes(
  context: KeystoneContext,
  values: string[],
): Promise<PetPlaceTypeRow[]> {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  const rows: PetPlaceTypeRow[] = [];
  for (const value of unique) {
    const row = await ensurePetPlaceType(context, value);
    if (row) rows.push(row);
  }
  return rows;
}
