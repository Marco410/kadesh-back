import { KeystoneContext } from "@keystone-6/core/types";
import { createAnimalTypes } from "./animal_types";
import { createUserAdmin } from "./user";
import { createVeterinary } from "./veterinary";
import { createPetPlaceTypes } from "./pet_place_types";
import { createPetPlaceService } from "./veterinary_services";
import { createSaasCompany } from "./saas_company";
import { createSaasPlan } from "./saas_plan";

export default async function seed(context: KeystoneContext) {
  await createAnimalTypes(context);
  await createPetPlaceTypes(context);
  const userID = await createUserAdmin(context);
  const services = await createPetPlaceService(context);

  await createVeterinary(context, userID, services);
  const planId = await createSaasPlan(context);
  await createSaasCompany(context, planId);
}