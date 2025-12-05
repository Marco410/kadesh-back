import { KeystoneContext } from "@keystone-6/core/types";
import { services } from "../../models/PetPlace/const";

export async function createPetPlaceService(context: KeystoneContext) {
  const existingSer = await context.sudo().query.PetPlaceService.findMany({
    query: "id",
  });
  if (existingSer.length > 0) {
    console.log("♻️  Skipped veterinary services seeding.");
    return existingSer;
  }

  const servicess = await context.sudo().query.PetPlaceService.createMany({
    data: services,
    query: "id",
  });

  console.log("✅ Veterinary Services seeding complete.");

  return servicess;
}
