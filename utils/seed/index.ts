import { KeystoneContext } from "@keystone-6/core/types";
import { createAnimalTypes } from "./animal_types";
import { createUserAdmin } from "./user";

export default async function seed(context: KeystoneContext) {
  await createAnimalTypes(context);
  await createUserAdmin(context);
}
