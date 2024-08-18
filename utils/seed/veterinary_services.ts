import { KeystoneContext } from "@keystone-6/core/types";
import { services } from "../../models/Veterinary/const";

export async function createVeterinaryService(context: KeystoneContext) {
  const existingSer = await context.sudo().query.VeterinaryService.findMany({
    query: "id",
  });
  if (existingSer.length > 0) {
    console.log("♻️  Skipped veterinary services seeding.");
    return existingSer;
  }

  const servicess = await context.sudo().query.VeterinaryService.createMany({
    data: services,
    query: "id",
  });

  console.log("✅ Veterinary Services seeding complete.");

  return servicess;
}
