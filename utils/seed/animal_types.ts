import { KeystoneContext } from "@keystone-6/core/types";
import {
  AnimalTypes,
  BIRD_BREEDS,
  CAT_BREEDS,
  DOG_BREEDS,
  FISH_BREEDS,
  MAMMAL_BREEDS,
  REPTIL_BREEDS,
} from "../../utils/constants/constants";
export async function createAnimalTypes(context: KeystoneContext) {
  const existingTypes = await context.sudo().query.AnimalType.findMany();
  if (existingTypes.length > 0) {
    console.log("♻️  Skipped Animal Type seeding.");
    return existingTypes;
  }
  const animalTypesNames = [
    {
      name: AnimalTypes.DOG,
      order: 1,
      breeds: DOG_BREEDS,
    },
    {
      name: AnimalTypes.CAT,
      order: 2,
      breeds: CAT_BREEDS,
    },
    { name: AnimalTypes.BIRD, order: 3, breeds: BIRD_BREEDS },
    {
      name: AnimalTypes.FISH,
      order: 4,
      breeds: FISH_BREEDS,
    },
    {
      name: AnimalTypes.REPTIL,
      order: 5,
      breeds: REPTIL_BREEDS,
    },
    {
      name: AnimalTypes.MAMMAL,
      order: 6,
      breeds: MAMMAL_BREEDS,
    },
  ];

  await Promise.all(
    animalTypesNames.map(async (animal) => {
      try {
        const createdAnimal = await context.sudo().db.AnimalType.createOne({
          data: {
            name: animal.name,
            order: animal.order,
          },
        });

        const breedsData = animal.breeds.map((breed, index) => ({
          breed,
          animal_type: { connect: { id: createdAnimal.id } },
        }));

        await context.sudo().db.AnimalBreed.createMany({
          data: breedsData,
        });

        console.log(
          `AnimalType and breeds for ${animal.name} created successfully`
        );
      } catch (err) {
        console.error(`Error creating AnimalType: ${animal.name}`, err);
      }
    })
  );

  console.log("✅ AnimalTypes seeding complete.");
}
