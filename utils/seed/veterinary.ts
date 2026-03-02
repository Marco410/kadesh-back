import { KeystoneContext } from "@keystone-6/core/types";

export async function createVeterinary(
  context: KeystoneContext,
  userID: string,
  services: readonly Record<string, any>[],
) {
  const existingVet = await context.sudo().query.PetPlace.findMany();
  if (existingVet.length > 0) {
    console.log("♻️  Skipped veterinary seeding.");
    return existingVet;
  }

  const [veterinaryType] = await context.sudo().query.PetPlaceType.findMany({
    where: { value: { equals: "veterinary" } },
    take: 1,
    query: "id",
  });
  if (!veterinaryType) {
    console.log(
      "⚠️  Skipped veterinary seeding: PetPlaceType 'veterinary' not found.",
    );
    return [];
  }

  try {
    await context.sudo().query.PetPlace.createOne({
      data: {
        name: "Kade",
        description:
          "Esta es la primera veterinaria en el mundo para hacer las cosas cambiar.",
        phone: "4434012693",
        types: { connect: [{ id: veterinaryType.id }] },
        website: "https://www.kadeveterinaria.com",
        street: "Calle 123",
        municipality: "Morelia",
        state: "Michoacán",
        country: "México",
        cp: "58070",
        lat: "19.695867",
        lng: "-101.198932",
        views: 10,
        services: { connect: { id: services[0].id } },
        user: { connect: { id: userID } },
      },
      query: "id",
    });
    console.log("✅ Veterinary seeding complete.");
  } catch (err) {
    console.log("err");
    console.log(err);
  }
}
