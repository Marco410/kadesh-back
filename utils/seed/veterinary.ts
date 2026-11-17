import { KeystoneContext } from "@keystone-6/core/types";

/**
 * Fictional veterinaries in Morelia for local development, so nearby searches have
 * data without calling Google Places (see PET_PLACES_GOOGLE_SYNC). Names and phones
 * are made up; coordinates are real neighborhoods of the city.
 */
const MORELIA_DEV_VETERINARIES = [
  {
    name: "Veterinaria Centro Histórico",
    street: "Av. Madero Poniente 412",
    neighborhood: "Centro",
    cp: "58000",
    lat: "19.702600",
    lng: "-101.192300",
    phone: "+52 443 555 0101",
  },
  {
    name: "Clínica Veterinaria Chapultepec",
    street: "Gral. Anaya 235",
    neighborhood: "Chapultepec Norte",
    cp: "58260",
    lat: "19.691200",
    lng: "-101.170400",
    phone: "+52 443 555 0102",
  },
  {
    name: "Hospital Veterinario Las Américas",
    street: "Av. Enrique Ramírez 980",
    neighborhood: "Las Américas",
    cp: "58270",
    lat: "19.684900",
    lng: "-101.160300",
    phone: "+52 443 555 0103",
  },
  {
    name: "Veterinaria Félix Ireta",
    street: "Av. Lázaro Cárdenas 1650",
    neighborhood: "Félix Ireta",
    cp: "58070",
    lat: "19.688300",
    lng: "-101.182100",
    phone: "+52 443 555 0104",
  },
  {
    name: "Centro Veterinario Altozano",
    street: "Av. Montaña Monarca 1000",
    neighborhood: "Altozano",
    cp: "58350",
    lat: "19.668200",
    lng: "-101.165300",
    phone: "+52 443 555 0105",
  },
  {
    name: "Veterinaria Prados Verdes",
    street: "Av. Pedregal 318",
    neighborhood: "Prados Verdes",
    cp: "58110",
    lat: "19.722400",
    lng: "-101.214800",
    phone: "+52 443 555 0106",
  },
  {
    name: "Clínica de Mascotas Villa Universidad",
    street: "Av. Universidad 1234",
    neighborhood: "Villa Universidad",
    cp: "58060",
    lat: "19.686100",
    lng: "-101.205200",
    phone: "+52 443 555 0107",
  },
  {
    name: "Veterinaria Santa María",
    street: "Calz. Juárez 2105",
    neighborhood: "Santa María de Guido",
    cp: "58090",
    lat: "19.665400",
    lng: "-101.190600",
    phone: "+52 443 555 0108",
  },
  {
    name: "Hospital de Pequeñas Especies Tres Marías",
    street: "Paseo de la República 5300",
    neighborhood: "Tres Marías",
    cp: "58254",
    lat: "19.676800",
    lng: "-101.118500",
    phone: "+52 443 555 0109",
  },
  {
    name: "Veterinaria Lomas de Hidalgo",
    street: "Av. Acueducto 3015",
    neighborhood: "Lomas de Hidalgo",
    cp: "58240",
    lat: "19.697500",
    lng: "-101.155900",
    phone: "+52 443 555 0110",
  },
];

/** Dev only and re-runnable: creates the ones that are missing, matched by name. */
async function createMoreliaDevVeterinaries(
  context: KeystoneContext,
  veterinaryTypeId: string,
  services: readonly Record<string, any>[],
) {
  const env = process.env.ENVIROMENT?.trim().toLowerCase();
  if (env !== "dev") return;

  const sudo = context.sudo();
  const existing = await sudo.query.PetPlace.findMany({
    where: {
      name: { in: MORELIA_DEV_VETERINARIES.map((vet) => vet.name) },
      municipality: { equals: "Morelia" },
    },
    query: "name",
  });
  const existingNames = new Set(existing.map((place) => place.name));
  const missing = MORELIA_DEV_VETERINARIES.filter(
    (vet) => !existingNames.has(vet.name),
  );
  if (missing.length === 0) {
    console.log("♻️  Skipped Morelia veterinaries seeding.");
    return;
  }

  let created = 0;
  for (const [index, vet] of missing.entries()) {
    const address = `${vet.street}, ${vet.neighborhood}, ${vet.cp} Morelia, Mich., México`;
    const service = services.length
      ? services[index % services.length]
      : undefined;
    try {
      await sudo.query.PetPlace.createOne({
        data: {
          name: vet.name,
          description: `Ubicada en ${address}.`,
          phone: vet.phone,
          types: { connect: [{ id: veterinaryTypeId }] },
          website: "",
          street: vet.street,
          municipality: "Morelia",
          state: "Michoacán",
          country: "México",
          cp: vet.cp,
          lat: vet.lat,
          lng: vet.lng,
          address,
          views: 0,
          ...(service ? { services: { connect: { id: service.id } } } : {}),
        },
        query: "id",
      });
      created += 1;
    } catch (err) {
      console.log(`Error seeding veterinary "${vet.name}":`, err);
    }
  }
  console.log(`✅ Morelia veterinaries seeding complete (${created} created).`);
}

export async function createVeterinary(
  context: KeystoneContext,
  userID: string,
  services: readonly Record<string, any>[],
) {
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

  const existingCount = await context.sudo().query.PetPlace.count();
  if (existingCount > 0) {
    console.log("♻️  Skipped veterinary seeding.");
  } else {
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

  await createMoreliaDevVeterinaries(context, veterinaryType.id, services);
}
