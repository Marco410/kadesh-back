import { KeystoneContext } from "@keystone-6/core/types";
import { createAnimalTypes } from "./animal_types";
import { createUserAdmin } from "./user";
import { createVeterinaryService } from "./veterinary_services";
import { createVeterinary } from "./veterinary";
import { createPetPlaceTypes } from "./pet_place_types";

export default async function seed(context: KeystoneContext) {
  await createAnimalTypes(context);
  await createPetPlaceTypes(context);
  const userID = await createUserAdmin(context);
  const services = await createVeterinaryService(context);

  await createVeterinary(context, userID, services);
}
