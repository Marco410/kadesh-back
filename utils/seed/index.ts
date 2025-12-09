import { KeystoneContext } from "@keystone-6/core/types";
import { createAnimalTypes } from "./animal_types";
import { createUserAdmin } from "./user";
import { createVeterinary } from "./veterinary";
import { createPetPlaceService } from "./veterinary_services";

export default async function seed(context: KeystoneContext) {
  await createAnimalTypes(context);
  const userID = await createUserAdmin(context);
  const services = await createPetPlaceService(context);

  await createVeterinary(context, userID, services);
}
