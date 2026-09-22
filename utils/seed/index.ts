import { KeystoneContext } from "@keystone-6/core/types";
import { ROLES } from "../../models/Role/constants";
import { createAnimalTypes } from "./animal_types";
import { createUserAdmin } from "./user";
import { createVeterinary } from "./veterinary";
import { createPetPlaceTypes } from "./pet_place_types";
import { createPetPlaceService } from "./veterinary_services";
import { createSaasCompany } from "./saas_company";
import { createSaasPlan } from "./saas_plan";
import { createSaasCreditPackages } from "./saas_credits";

async function createRoles(context: KeystoneContext) {
  const sudo = context.sudo();
  for (const role of ROLES) {
    const existing = await sudo.db.Role.findOne({
      where: { name: role.value },
    });

    if (!existing) {
      await sudo.db.Role.createOne({
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
  const planId = await createSaasPlan(context);
  await createSaasCreditPackages(context);
  const userID = await createUserAdmin(context);
  const services = await createPetPlaceService(context);

  await createVeterinary(context, userID, services);
  await createSaasCompany(context, planId);
}