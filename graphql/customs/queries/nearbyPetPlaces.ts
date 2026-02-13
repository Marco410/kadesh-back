import { KeystoneContext } from "@keystone-6/core/types";
import { PET_PLACES_SEED_LOCATION } from "../../../utils/constants/constants";
import { haversineDistance } from "../../../utils/helpers/calculate_distances";
import { getPetPlacesHelper, searchPlacesByLocation } from "../../../utils/helpers/nearby_petplaces";

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

    // Caso A: sin lat/lng — priorizar Google para alimentar BD, luego devolver por rating
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      const searchType = type || "veterinary";
      const seedRadius = 15;
      const feedLimit = 20;
      try {
        await searchPlacesByLocation(
          PET_PLACES_SEED_LOCATION.lat,
          PET_PLACES_SEED_LOCATION.lng,
          searchType,
          seedRadius,
          feedLimit,
          context
        );
      } catch (err) {
        console.error("Error alimentando BD desde Google (Caso A):", err);
      }

      const whereClause: any = {};
      if (type) {
        const petPlaceType = await context.sudo().query.PetPlaceType.findOne({
          where: { value: type },
          query: "id",
        });
        if (petPlaceType) {
          whereClause.types = {
            some: { id: { equals: petPlaceType.id } },
          };
        }
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

    // Caso C: priorizar Google para alimentar BD (sin duplicados por google_place_id), luego responder desde BD
    const searchType = type || "veterinary";
    try {
      await searchPlacesByLocation(lat, lng, searchType, radius, limit, context);
    } catch (err) {
      console.error("Error alimentando BD desde Google (Caso C):", err);
    }

    const petPlaces = await getPetPlacesHelper(context, {});
    const withDistance = petPlaces
      .map((place: any) => {
        const placeLat = parseFloat(place.lat);
        const placeLng = parseFloat(place.lng);
        if (isNaN(placeLat) || isNaN(placeLng)) return null;
        const distance = haversineDistance(lat, lng, placeLat, placeLng);
        return { ...place, distance };
      })
      .filter((place: any) => place && place.distance <= radius);

    withDistance.sort((a: any, b: any) => a.distance - b.distance);
    const result = withDistance.slice(0, limit).map((place: any) => ({
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