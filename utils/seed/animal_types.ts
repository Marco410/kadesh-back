import { KeystoneContext } from "@keystone-6/core/types";
import { AnimalTypes, dogBreeds } from "../../utils/constants/constants";
export async function createAnimalTypes(context: KeystoneContext) {
  // Check if there are already roles
  const existingTypes = await context.sudo().query.AnimalType.findMany();
  if (existingTypes.length > 0) {
    console.log("♻️  Skipped Animal Type seeding.");
    return existingTypes;
  }
  const animalTypesNames = [
    {
      name: AnimalTypes.DOG,
      order: 1,
      breeds: dogBreeds,
    },
    {
      name: AnimalTypes.CAT,
      order: 2,
      breeds: ["Persian", "Siamese", "Bengal"],
    },
    { name: AnimalTypes.BIRD, order: 3, breeds: ["Parrot", "Canary", "Finch"] },
    {
      name: AnimalTypes.FISH,
      order: 4,
      breeds: ["Goldfish", "Betta", "Cichlid"],
    },
    {
      name: AnimalTypes.REPTIL,
      order: 5,
      breeds: ["Gecko", "Python", "Iguana"],
    },
    {
      name: AnimalTypes.MAMMAL,
      order: 6,
      breeds: ["Rabbit", "Ferret", "Hamster"],
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

  /*   const data = await context.sudo().query.AnimalType.createMany({
    data: animalTypesNames,
    query: "id",
  }); */
  console.log("✅ AnimalTypes seeding complete.");
}
