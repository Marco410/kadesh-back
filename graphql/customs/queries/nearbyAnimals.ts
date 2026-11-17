import { KeystoneContext } from "@keystone-6/core/types";
import {
  MAP_SIGHTING_HOURS,
  MAP_SIGHTINGS_PER_ANIMAL,
  SIGHTING_STATUSES,
} from "../../../models/Pet/Animal/AnimalSighting/constants";
import { queryNearbyAnimals, type NearbyAnimalRow } from "../../../utils/pet/nearbyAnimalsSql";

/**
 * Reportes cerca de una ubicación (o los más recientes sin ella).
 *
 * - `getNearbyAnimals`: lista paginada en la base (`limit`/`skip`), con fotos y autor. La usan la
 *   lista de `/animales`, la portada y las alertas de zona.
 * - `getNearbyAnimalPins`: todos los del filtro para el mapa (hasta `MAX_PINS`), sin autor y con una
 *   sola foto de portada.
 *
 * Filtros, orden y paginación van en SQL (`utils/pet/nearbyAnimalsSql.ts`): el costo crece con lo
 * que se devuelve, no con el total de reportes.
 */

/** Tope de `limit` en la lista (la app instalada puede pedir más; antes no había tope). */
const MAX_LIST_LIMIT = 500;
/** Tope de pines en el mapa. Si se llega, hace falta agrupar en el servidor. */
const MAX_PINS = 1000;

const typeDefs = `
  type AnimalMultimediaImage {
    id: ID!
    url: String
    order: Int
  }

  type NearbyAnimalUser {
    name: String
    profileImage: NearbyAnimalUserProfileImage
  }

  type NearbyAnimalUserProfileImage {
    url: String
  }

  "«Lo vi» de las últimas 72 h, para el mapa (sin contacto)."
  type NearbyAnimalSighting {
    id: ID!
    lat: String!
    lng: String!
    seenAt: String
    placeLabel: String
    city: String
  }

  type NearbyAnimal {
    id: ID!
    slug: String
    name: String
    sex: String
    distance: Float
    status: String
    lat: String
    lng: String
    address: String
    city: String
    state: String
    country: String
    animal_type: AnimalType
    animal_breed: AnimalBreed
    user: NearbyAnimalUser
    multimedia: [AnimalMultimediaImage]
    createdAt: String
    "Hasta 3 avistamientos visibles de las últimas 72 h (solo perdidos y abandonados), el más reciente primero."
    recentSightings: [NearbyAnimalSighting!]
  }

  type NearbyAnimalsResult {
    success: Boolean!
    message: String!
    animals: [NearbyAnimal!]
    total: Int!
  }

  "Un pin del mapa: lo que pinta el pin y su ventanita, sin autor y con una sola foto."
  type NearbyAnimalPin {
    id: ID!
    slug: String
    name: String
    sex: String
    status: String
    lat: String
    lng: String
    distance: Float
    typeName: String
    breedName: String
    address: String
    city: String
    state: String
    country: String
    createdAt: String
    coverUrl: String
    recentSightings: [NearbyAnimalSighting!]
  }

  type NearbyAnimalPinsResult {
    success: Boolean!
    animals: [NearbyAnimalPin!]!
    "Total del filtro; si pasa de los pines devueltos, el mapa no los muestra todos."
    total: Int!
  }

  input NearbyAnimalsInput {
    lat: Float
    lng: Float
    limit: Int = 10
    skip: Int = 0
    radius: Float = 10
    animalType: ID
    status: String
    breed: ID
    location: String
  }

  type Query {
    getNearbyAnimals(input: NearbyAnimalsInput!): NearbyAnimalsResult!
    getNearbyAnimalPins(input: NearbyAnimalsInput!): NearbyAnimalPinsResult!
  }
`;

const definition = `
  getNearbyAnimals(input: NearbyAnimalsInput!): NearbyAnimalsResult!
  getNearbyAnimalPins(input: NearbyAnimalsInput!): NearbyAnimalPinsResult!
`;

type NearbyAnimalsInput = {
  lat?: number | null;
  lng?: number | null;
  limit?: number | null;
  skip?: number | null;
  radius?: number | null;
  animalType?: string | null;
  status?: string | null;
  breed?: string | null;
  location?: string | null;
};

/**
 * "MM/DD/YYYY, hh:mm:ss AM/PM" (hora del servidor, UTC). Formato histórico de `createdAt` en esta
 * consulta: la web (`zoneAlerts.ts`) y la app lo leen así.
 */
function formatDate(date: Date | string | null): string | null {
  if (!date) return null;
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const year = value.getFullYear();
  let hours = value.getHours();
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${month}/${day}/${year}, ${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
}

function prismaOf(context: KeystoneContext) {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

function filtersOf(input: NearbyAnimalsInput) {
  return {
    lat: input.lat,
    lng: input.lng,
    radius: input.radius ?? 10,
    animalType: input.animalType,
    breed: input.breed,
    status: input.status,
    location: input.location,
  };
}

type MapSighting = {
  id: string;
  lat: string;
  lng: string;
  seenAt: string | null;
  placeLabel: string | null;
  city: string | null;
};

/**
 * «Lo vi» recientes de los animales devueltos, en una sola consulta (no una por animal).
 * Solo de los que siguen en la calle; los ocultos por quien atiende el reporte no salen.
 */
async function getRecentSightings(
  rows: Array<Pick<NearbyAnimalRow, "id" | "status">>,
  context: KeystoneContext,
): Promise<Map<string, MapSighting[]>> {
  const ids = rows.filter((row) => SIGHTING_STATUSES.includes(row.status)).map((row) => row.id);
  const byAnimal = new Map<string, MapSighting[]>();
  if (ids.length === 0) return byAnimal;

  const since = new Date(Date.now() - MAP_SIGHTING_HOURS * 60 * 60 * 1000);
  const sightings = await prismaOf(context).animalSighting.findMany({
    where: { animalId: { in: ids }, hidden: false, seenAt: { gte: since } },
    orderBy: [{ seenAt: "desc" }],
    // Tope duro: ningún animal pasa de 3 en el mapa.
    take: ids.length * MAP_SIGHTINGS_PER_ANIMAL * 4,
    select: { id: true, animalId: true, lat: true, lng: true, seenAt: true, placeLabel: true, city: true },
  });
  // Prisma de Keystone devuelve el error en vez de lanzarlo: sin avistamientos, el mapa sigue.
  if (sightings instanceof Error) {
    console.error("[nearbyAnimals] avistamientos:", sightings);
    return byAnimal;
  }
  for (const row of sightings as Array<Omit<MapSighting, "seenAt"> & { animalId: string; seenAt: Date | null }>) {
    const list = byAnimal.get(row.animalId) ?? [];
    if (list.length >= MAP_SIGHTINGS_PER_ANIMAL) continue;
    list.push({
      id: row.id,
      lat: row.lat,
      lng: row.lng,
      seenAt: row.seenAt ? new Date(row.seenAt).toISOString() : null,
      placeLabel: row.placeLabel || null,
      city: row.city || null,
    });
    byAnimal.set(row.animalId, list);
  }
  return byAnimal;
}

type MediaItem = { id: string; url: string | null; order: number };

/** Fotos de los animales devueltos (con URL firmada), agrupadas y en orden. Una consulta. */
async function getMultimedia(ids: string[], context: KeystoneContext): Promise<Map<string, MediaItem[]>> {
  const byAnimal = new Map<string, MediaItem[]>();
  if (ids.length === 0) return byAnimal;
  const media = (await context.sudo().query.AnimalMultimedia.findMany({
    where: { animal: { id: { in: ids } } },
    orderBy: [{ order: "asc" }],
    query: "id order image { url } animal { id }",
  })) as Array<{ id: string; order?: number | null; image?: { url?: string | null } | null; animal?: { id: string } | null }>;
  for (const item of media) {
    const animalId = item.animal?.id;
    if (!animalId) continue;
    const list = byAnimal.get(animalId) ?? [];
    list.push({ id: item.id, url: item.image?.url ?? null, order: item.order ?? 10_000 });
    byAnimal.set(animalId, list);
  }
  for (const list of byAnimal.values()) list.sort((a, b) => a.order - b.order);
  return byAnimal;
}

/**
 * Una foto de portada por animal (la de menor `order`) para los pines: primero los ids con SQL y
 * luego solo esas fotos por Keystone, que es quien firma la URL.
 */
async function getCoverUrls(ids: string[], context: KeystoneContext): Promise<Map<string, string>> {
  const covers = new Map<string, string>();
  if (ids.length === 0) return covers;
  const firsts = await prismaOf(context).$queryRaw`
    SELECT DISTINCT ON (m."animal") m.id
    FROM "AnimalMultimedia" m
    WHERE m."animal" = ANY(${ids}::text[])
    ORDER BY m."animal", m."order" ASC, m."createdAt" ASC NULLS LAST
  `;
  if (firsts instanceof Error) {
    console.error("[nearbyAnimals] portadas:", firsts);
    return covers;
  }
  const mediaIds = (firsts as Array<{ id: string }>).map((row) => row.id);
  if (mediaIds.length === 0) return covers;
  const media = (await context.sudo().query.AnimalMultimedia.findMany({
    where: { id: { in: mediaIds } },
    query: "image { url } animal { id }",
  })) as Array<{ image?: { url?: string | null } | null; animal?: { id: string } | null }>;
  for (const item of media) {
    if (item.animal?.id && item.image?.url) covers.set(item.animal.id, item.image.url);
  }
  return covers;
}

/** Autor de cada reporte (nombre y foto). Solo para la lista paginada. */
async function getAuthors(ids: string[], context: KeystoneContext) {
  const byAnimal = new Map<string, { name: string | null; profileImage: { url: string | null } | null }>();
  if (ids.length === 0) return byAnimal;
  const animals = (await context.sudo().query.Animal.findMany({
    where: { id: { in: ids } },
    query: "id user { name profileImage { url } }",
  })) as Array<{ id: string; user?: { name?: string | null; profileImage?: { url?: string | null } | null } | null }>;
  for (const animal of animals) {
    if (!animal.user) continue;
    byAnimal.set(animal.id, {
      name: animal.user.name ?? null,
      profileImage: animal.user.profileImage ? { url: animal.user.profileImage.url ?? null } : null,
    });
  }
  return byAnimal;
}

function clampInt(value: number | null | undefined, fallback: number, max: number) {
  const num = Math.floor(Number(value ?? fallback));
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.min(num, max);
}

const resolver = {
  getNearbyAnimals: async (_root: unknown, { input }: { input: NearbyAnimalsInput }, context: KeystoneContext) => {
    const limit = clampInt(input.limit, 10, MAX_LIST_LIMIT);
    const skip = clampInt(input.skip, 0, Number.MAX_SAFE_INTEGER);
    const { rows, total } = await queryNearbyAnimals(prismaOf(context), filtersOf(input), { limit, skip });

    const ids = rows.map((row) => row.id);
    const [multimedia, authors, sightings] = await Promise.all([
      getMultimedia(ids, context),
      getAuthors(ids, context),
      getRecentSightings(rows, context),
    ]);

    const animals = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      sex: row.sex,
      distance: row.distance,
      status: row.status,
      lat: row.lat,
      lng: row.lng,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      animal_type: row.typeId ? { id: row.typeId, name: row.typeName } : null,
      animal_breed: row.breedId ? { id: row.breedId, breed: row.breedName } : null,
      user: authors.get(row.id) ?? null,
      multimedia: multimedia.get(row.id) ?? [],
      createdAt: formatDate(row.createdAt),
      recentSightings: sightings.get(row.id) ?? [],
    }));

    return {
      success: true,
      message: animals.length > 0 ? "Animals found" : "No animals found",
      animals,
      total,
    };
  },

  /**
   * Pines del mapa: todos los del filtro (hasta `MAX_PINS`), ligeros. Ignora `limit` y `skip`
   * (el input los trae con valor por defecto, 10 y 0, aunque no se manden).
   */
  getNearbyAnimalPins: async (_root: unknown, { input }: { input: NearbyAnimalsInput }, context: KeystoneContext) => {
    const { rows, total } = await queryNearbyAnimals(prismaOf(context), filtersOf(input), { limit: MAX_PINS, skip: 0 });
    const ids = rows.map((row) => row.id);
    const [covers, sightings] = await Promise.all([getCoverUrls(ids, context), getRecentSightings(rows, context)]);

    return {
      success: true,
      total,
      animals: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        sex: row.sex,
        status: row.status,
        lat: row.lat,
        lng: row.lng,
        distance: row.distance,
        typeName: row.typeName,
        breedName: row.breedName,
        address: row.address,
        city: row.city,
        state: row.state,
        country: row.country,
        createdAt: formatDate(row.createdAt),
        coverUrl: covers.get(row.id) ?? null,
        recentSightings: sightings.get(row.id) ?? [],
      })),
    };
  },
};

export default { typeDefs, definition, resolver };
