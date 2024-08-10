import { KeystoneContext } from "@keystone-6/core/types";
import { AnimalTypes } from "../../utils/constants/constants";
export async function createAnimalTypes(context: KeystoneContext) {
  // Check if there are already roles
  const existingTypes = await context.sudo().query.AnimalType.findMany();
  if (existingTypes.length > 0) {
    console.log("♻️  Skipped Animal Type seeding.");
    return existingTypes;
  }
  const animalTypesNames = [
    { name: AnimalTypes.DOG, order: 1 },
    { name: AnimalTypes.CAT, order: 2 },
    { name: AnimalTypes.BIRD, order: 3 },
    { name: AnimalTypes.FISH, order: 4 },
    { name: AnimalTypes.HAMSTER, order: 5 },
    { name: AnimalTypes.RABBIT, order: 6 },
    { name: AnimalTypes.DUCK, order: 7 },
    { name: AnimalTypes.SNAKE, order: 8 },
    { name: AnimalTypes.OTHER, order: 9 },
  ];

  const data = await context.sudo().query.AnimalType.createMany({
    data: animalTypesNames,
    query: "id",
  });
  console.log("✅ AnimalTypes seeding complete.");
}
