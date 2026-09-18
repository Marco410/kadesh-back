import { KeystoneContext } from "@keystone-6/core/types";
import { TYPES_PET_SHELTER } from "../constants/constants";

export async function createPetPlaceTypes(context: KeystoneContext) {
  const existingTypes = (await context.sudo().query.PetPlaceType.findMany({
    query: "id value",
  })) as Array<{ id: string; value: string }>;
  const existingValues = new Set(existingTypes.map((type) => type.value));
  const missing = TYPES_PET_SHELTER.filter(
    (type) => !existingValues.has(type.value),
  );

  if (missing.length === 0) {
    console.log("♻️  PetPlaceType: el catálogo ya está completo.");
    return existingTypes;
  }

  console.log(`🌱 Creando ${missing.length} PetPlaceType(s) faltantes...`);
  const created: Array<{ id: string; value: string }> = [];

  for (const type of missing) {
    try {
      const row = (await context.sudo().query.PetPlaceType.createOne({
        data: {
          label: type.label,
          value: type.value,
          plural: type.plural,
        },
        query: "id value",
      })) as { id: string; value: string };
      created.push(row);
      console.log(`✅ Created PetPlaceType: ${type.label}`);
    } catch (error) {
      console.error(`❌ Error creating PetPlaceType ${type.label}:`, error);
    }
  }

  return [...existingTypes, ...created];
}
