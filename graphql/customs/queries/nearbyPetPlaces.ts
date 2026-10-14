import { KeystoneContext } from "@keystone-6/core/types";
import { PET_PLACES_SEED_LOCATION } from "../../../utils/constants/constants";
import {
  ensureAreaSearchedOnGoogle,
  findPetPlacesNear,
  getPetPlacesHelper,
  MIN_DB_RESULTS,
} from "../../../utils/helpers/nearby_petplaces";

const typeDefs = `
  type PetPlaceType {
    id: ID!
    label: String
    value: String
    plural: String
  }

  type NearbyPetPlace {
    id: ID!
    name: String
    slug: String
    description: String
    lat: String
    lng: String
    distance: Float
    address: String
    phone: String
    website: String
    street: String
    municipality: String
    state: String
    country: String
    cp: String
    views: String
    types: [PetPlaceType]
    services: [PetPlaceService]
    user: User
    isOpen: Boolean
    pet_place_social_media: [SocialMedia]
    pet_place_likes: [PetPlaceLike]
    pet_place_schedules: [Schedule]
    pet_place_reviews: [Review]
    pet_place_ads: [Ad]
    google_place_id: String
    google_opening_hours: String
    createdAt: String
    reviewsCount: Int
    averageRating: Float
    verified: Boolean
  }

  type NearbyPetPlacesResult {
    success: Boolean!
    message: String!
    petPlaces: [NearbyPetPlace!]
  }

  input NearbyPetPlacesInput {
    lat: Float
    lng: Float
    limit: Int = 10
    radius: Float = 10
    type: String
  }

  type Query {
    getNearbyPetPlaces(input: NearbyPetPlacesInput!): NearbyPetPlacesResult!
  }
`;

const definition = `
  getNearbyPetPlaces(input: NearbyPetPlacesInput!): NearbyPetPlacesResult!
`;


const resolver = {
  getNearbyPetPlaces: async (
    root: any,
    { input }: { input: { lat?: number; lng?: number; limit?: number; radius?: number; type?: string } },
    context: KeystoneContext
  ) => {
    const { lat, lng, limit = 10, radius = 10, type } = input;

    // Caso A: sin lat/lng — devolver por rating; solo se consulta Google si la BD está casi vacía.
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      const searchType = type || "veterinary";
      const seedRadius = 15;

      const seeded = await findPetPlacesNear(context, {
        lat: PET_PLACES_SEED_LOCATION.lat,
        lng: PET_PLACES_SEED_LOCATION.lng,
        radiusKm: seedRadius,
        type: searchType,
      });
      if (seeded.length < MIN_DB_RESULTS) {
        try {
          await ensureAreaSearchedOnGoogle(context, {
            lat: PET_PLACES_SEED_LOCATION.lat,
            lng: PET_PLACES_SEED_LOCATION.lng,
            type: searchType,
            radiusKm: seedRadius,
          });
        } catch (err) {
          console.error("Error alimentando BD desde Google (Caso A):", err);
        }
      }

      const whereClause: any = {};
      if (type) {
        whereClause.types = { some: { value: { equals: type } } };
      }

      const petPlaces = await getPetPlacesHelper(context, whereClause);

      // Sort by averageRating descending (highest first)
      const sortedPlaces = [...petPlaces].sort((a: any, b: any) => {
        const ratingA = a.averageRating || 0;
        const ratingB = b.averageRating || 0;
        return ratingB - ratingA; // Descending order
      });

      const result = sortedPlaces.slice(0, limit).map((place: any) => ({
        ...place,
        pet_place_reviews: place.pet_place_reviews ?? [],
        distance: null, // No distance when lat/lng not provided
      }));

      return {
        success: true,
        message: result.length > 0 ? "PetPlaces found" : "No PetPlaces found",
        petPlaces: result,
      };
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return {
        success: false,
        message: "Invalid latitude and longitude",
        petPlaces: [],
      };
    }

    // Caso C: primero la BD; Google solo si hay pocos resultados y la zona no se ha buscado antes.
    const searchType = type || "veterinary";
    const query = { lat, lng, radiusKm: radius, type: searchType };

    let places = await findPetPlacesNear(context, query);
    if (places.length < MIN_DB_RESULTS) {
      try {
        const searched = await ensureAreaSearchedOnGoogle(context, {
          lat,
          lng,
          type: searchType,
          radiusKm: radius,
        });
        if (searched) places = await findPetPlacesNear(context, query);
      } catch (err) {
        console.error("Error alimentando BD desde Google (Caso C):", err);
      }
    }

    const result = places.slice(0, limit).map((place: any) => ({
      ...place,
      pet_place_reviews: place.pet_place_reviews ?? [],
    }));

    return {
      success: true,
      message: result.length > 0 ? "PetPlaces found" : "No PetPlaces found",
      petPlaces: result,
    };
  },
};

export default { typeDefs, definition, resolver }; 