import { KeystoneContext } from "@keystone-6/core/types";
import { TYPES_PET_SHELTER } from "../constants/constants";

export async function createPetPlaceTypes(context: KeystoneContext) {
  const existingTypes = await context.sudo().query.PetPlaceType.findMany();
  
  if (existingTypes.length > 0) {
    console.log("♻️  Skipped PetPlaceType seeding. Types already exist.");
    return existingTypes;
  }

  console.log("🌱 Creating PetPlaceType seed data...");

  const createdTypes = [];
  for (const type of TYPES_PET_SHELTER) {
    try {
      const created = await context.sudo().query.PetPlaceType.createOne({
        data: {
          label: type.label,
          value: type.value,
          plural: type.plural,
        },
      });
      createdTypes.push(created);
      console.log(`✅ Created PetPlaceType: ${type.label}`);
    } catch (error) {
      console.error(`❌ Error creating PetPlaceType ${type.label}:`, error);
    }
  }

  console.log(`✅ Created ${createdTypes.length} PetPlaceType(s)`);
  return createdTypes;
}
