import { KeystoneContext } from "@keystone-6/core/types";
import { haversineDistance } from "../../../utils/helpers/calculate_distances";

const typeDefs = `
  type AnimalMultimediaImage {
    id: ID!
    url: String
  }

  type NearbyAnimalUser {
    name: String
    profileImage: NearbyAnimalUserProfileImage
  }

  type NearbyAnimalUserProfileImage {
    url: String
  }

  type NearbyAnimal {
    id: ID!
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
  }

  type NearbyAnimalsResult {
    success: Boolean!
    message: String!
    animals: [NearbyAnimal!]
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
    city: String
    state: String
    country: String
  }

  type Query {
    getNearbyAnimals(input: NearbyAnimalsInput!): NearbyAnimalsResult!
  }
`;

const definition = `
  getNearbyAnimals(input: NearbyAnimalsInput!): NearbyAnimalsResult!
`;

/**
 * Gets the most recent AnimalLog for each animal
 * Returns a map of animalId -> latest log
 */
async function getLatestAnimalLogs(
  animalIds: string[],
  context: KeystoneContext
): Promise<Map<string, any>> {
  if (animalIds.length === 0) {
    return new Map();
  }

  const logs = await context.sudo().query.AnimalLog.findMany({
    where: { animal: { id: { in: animalIds } } },
    orderBy: { createdAt: "desc" },
    query: `
      id
      status
      lat
      lng
      address
      city
      state
      country
      createdAt
      animal {
        id
      }
    `,
  });

  // Group by animal and get the latest log for each
  const latestLogsMap = new Map<string, any>();
  const seenAnimals = new Set<string>();

  for (const log of logs) {
    const animalId = log.animal?.id;
    if (animalId && !seenAnimals.has(animalId)) {
      latestLogsMap.set(animalId, log);
      seenAnimals.add(animalId);
    }
  }

  return latestLogsMap;
}

const resolver = {
  getNearbyAnimals: async (
    root: any,
    {
      input,
    }: {
      input: {
        lat?: number;
        lng?: number;
        limit?: number;
        skip?: number;
        radius?: number;
        animalType?: string;
        status?: string;
        breed?: string;
        city?: string;
        state?: string;
        country?: string;
      };
    },
    context: KeystoneContext
  ) => {
    const {
      lat,
      lng,
      limit = 10,
      skip = 0,
      radius = 10,
      animalType,
      status,
      breed,
      city,
      state,
      country,
    } = input;

    // Build where clause for Animal query
    const animalWhere: any = {};

    if (animalType) {
      animalWhere.animal_type = { id: { equals: animalType } };
    }

    if (breed) {
      animalWhere.animal_breed = { id: { equals: breed } };
    }

    // Get all animals
    const animals = await context.sudo().query.Animal.findMany({
      where: animalWhere,
      query: `
        id
        name
        sex
        animal_type {
          id
          name
        }
        animal_breed {
          id
          breed
        }
        user {
          name
          profileImage {
            url
          }
        }
        createdAt
      `,
    });

    // Get all latest logs for these animals in one query
    const animalIds = animals.map((a: any) => a.id);
    const latestLogsMap = await getLatestAnimalLogs(animalIds, context);

    // Process animals: get latest log and apply filters
    const processedAnimals = [];

    for (const animal of animals) {
      // Get the most recent log for this animal
      const latestLog = latestLogsMap.get(animal.id);

      if (!latestLog) {
        continue; // Skip animals without logs
      }

      // Apply status filter
      if (status && latestLog.status !== status) {
        continue;
      }

      // Apply location filters (case-insensitive contains)
      if (city && !latestLog.city?.toLowerCase().includes(city.toLowerCase())) {
        continue;
      }
      if (state && !latestLog.state?.toLowerCase().includes(state.toLowerCase())) {
        continue;
      }
      if (country && !latestLog.country?.toLowerCase().includes(country.toLowerCase())) {
        continue;
      }

      // Calculate distance if lat/lng are provided
      let distance: number | null = null;
      if (lat !== undefined && lng !== undefined && latestLog.lat && latestLog.lng) {
        const logLat = parseFloat(latestLog.lat);
        const logLng = parseFloat(latestLog.lng);
        if (!isNaN(logLat) && !isNaN(logLng)) {
          distance = haversineDistance(lat, lng, logLat, logLng);
        }
      }

      // If lat/lng are provided, filter by radius
      if (lat !== undefined && lng !== undefined) {
        if (distance === null || distance > radius) {
          continue;
        }
      }

      // Convert user object with null prototype to plain object
      const userObj = animal.user ? {
        name: animal.user.name,
        profileImage: animal.user.profileImage ? {
          url: animal.user.profileImage.url,
        } : null,
      } : null;

      processedAnimals.push({
        ...animal,
        user: userObj,
        distance,
        status: latestLog.status,
        lat: latestLog.lat,
        lng: latestLog.lng,
        address: latestLog.address,
        city: latestLog.city,
        state: latestLog.state,
        country: latestLog.country,
      });
    }

    // Sort by distance if lat/lng are provided, otherwise by createdAt
    if (lat !== undefined && lng !== undefined) {
      processedAnimals.sort((a: any, b: any) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    } else {
      processedAnimals.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Most recent first
      });
    }

    // Apply pagination
    const total = processedAnimals.length;
    const paginatedAnimals = processedAnimals.slice(skip, skip + limit);

    // Get multimedia for paginated animals with proper image resolution
    const paginatedAnimalIds = paginatedAnimals.map((a: any) => a.id);
    const multimediaData = await context.sudo().query.AnimalMultimedia.findMany({
      where: { animal: { id: { in: paginatedAnimalIds } } },
      query: `
        id
        image {
          id
          url
        }
        animal {
          id
        }
      `,
    });

    // Group multimedia by animal
    const multimediaByAnimal = new Map<string, any[]>();
    for (const media of multimediaData) {
      const animalId = media.animal?.id;
      if (animalId) {
        if (!multimediaByAnimal.has(animalId)) {
          multimediaByAnimal.set(animalId, []);
        }
        // Convert image object with null prototype to plain object
        const imageObj = media.image ? {
          id: media.image.id,
          url: media.image.url,
        } : null;

        multimediaByAnimal.get(animalId)!.push(imageObj);
      }
    }

    const animalsWithMultimedia = paginatedAnimals.map((animal: any) => ({
      ...animal,
      multimedia: multimediaByAnimal.get(animal.id) || [],
    }));

    return {
      success: true,
      message:
        animalsWithMultimedia.length > 0
          ? "Animals found"
          : "No animals found",
      animals: animalsWithMultimedia,
      total,
    };
  },
};

export default { typeDefs, definition, resolver };
