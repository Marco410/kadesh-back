import { KeystoneContext } from "@keystone-6/core/types";
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

    // If lat and lng are not provided, return all PetPlaces of the specified type ordered by averageRating
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      const whereClause: any = {};
      
      // Filter by type if provided
      if (type) {
        const petPlaceType = await context.sudo().query.PetPlaceType.findOne({
          where: { value: type },
          query: 'id',
        });
        
        if (petPlaceType) {
          whereClause.types = {
            some: {
              id: {
                equals: petPlaceType.id,
              },
            },
          };
        }
      }

      const petPlaces = await getPetPlacesHelper( context, whereClause);

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

    // Original logic: search by location when lat and lng are provided
    if (typeof lat !== "number" || typeof lng !== "number") {
      return {
        success: false,
        message: "Invalid latitude and longitude",
        petPlaces: [],
      };
    }

    const petPlaces = await getPetPlacesHelper( context, {});
    
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
    let result = withDistance.slice(0, limit).map((place: any) => ({
      ...place,
      pet_place_reviews: place.pet_place_reviews ?? [],
    }));

    // Si hay menos resultados que el límite, buscar más en Google (p. ej. veterinarias)
    const searchType = type || 'veterinary';
    if (result.length < limit) {
      try {
        const needed = limit - result.length;
        console.log(
          result.length === 0
            ? `No places found in database, searching in Google Places for type: ${searchType}`
            : `Only ${result.length} places found, searching Google for ${needed} more (type: ${searchType})`
        );

        const createdPlaces = await searchPlacesByLocation(
          lat,
          lng,
          searchType,
          radius,
          needed,
          context
        );

        if (createdPlaces.length > 0) {
          const createdPlaceIds = createdPlaces.map((p: any) => p.id);

          const fullCreatedPlaces =  await getPetPlacesHelper( context, { id: { in: createdPlaceIds } });


          const newWithDistance = fullCreatedPlaces
            .map((place: any) => {
              const placeLat = parseFloat(place.lat);
              const placeLng = parseFloat(place.lng);
              if (isNaN(placeLat) || isNaN(placeLng)) return null;
              const distance = haversineDistance(lat, lng, placeLat, placeLng);
              return {
                ...place,
                distance,
                pet_place_reviews: place.pet_place_reviews ?? [],
              };
            })
            .filter((place: any) => place && place.distance <= radius);

          const existingIds = new Set(result.map((p: any) => p.id));
          const onlyNew = newWithDistance.filter((p: any) => !existingIds.has(p.id));
          const merged = [...result, ...onlyNew]
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, limit);
          result = merged;
        }
      } catch (error) {
        console.error('Error searching in Google Places:', error);
      }
    }
    
    return {
      success: true,
      message: result.length > 0 ? "PetPlaces found" : "No PetPlaces found",
      petPlaces: result,
    };
  },
};

export default { typeDefs, definition, resolver }; 