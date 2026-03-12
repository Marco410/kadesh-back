import { KeystoneContext } from "@keystone-6/core/types";
import { ROLES } from "../../models/Role/constants";
import { createAnimalTypes } from "./animal_types";
import { createUserAdmin } from "./user";
import { createVeterinary } from "./veterinary";
import { createPetPlaceTypes } from "./pet_place_types";
import { createPetPlaceService } from "./veterinary_services";
import { createSaasCompany } from "./saas_company";
import { createSaasPlan } from "./saas_plan";

async function createRoles(context: KeystoneContext) {
  for (const role of ROLES) {
    const existing = await context.db.Role.findOne({
      where: { name: role.value },
    });

    if (!existing) {
      await context.db.Role.createOne({
        data: {
          name: role.value,
        },
      });
    }
  }
}

export default async function seed(context: KeystoneContext) {
  await createRoles(context);
  await createAnimalTypes(context);
  await createPetPlaceTypes(context);
  const userID = await createUserAdmin(context);
  const services = await createPetPlaceService(context);

  await createVeterinary(context, userID, services);
  const planId = await createSaasPlan(context);
  await createSaasCompany(context, planId);
}