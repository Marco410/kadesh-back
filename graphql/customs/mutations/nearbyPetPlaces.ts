import { KeystoneContext } from "@keystone-6/core/types";

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
  }

  type NearbyPetPlacesResult {
    success: Boolean!
    message: String!
    petPlaces: [NearbyPetPlace!]
  }

  input NearbyPetPlacesInput {
    lat: Float!
    lng: Float!
    limit: Int = 10
    radius: Float = 10
  }

  type Mutation {
    getNearbyPetPlaces(input: NearbyPetPlacesInput!): NearbyPetPlacesResult!
  }
`;

const definition = `
  getNearbyPetPlaces(input: NearbyPetPlacesInput!): NearbyPetPlacesResult!
`;

/**
 * Calcula la distancia entre dos puntos geográficos usando la fórmula de Haversine
 * @param lat1 Latitud del primer punto
 * @param lng1 Longitud del primer punto
 * @param lat2 Latitud del segundo punto
 * @param lng2 Longitud del segundo punto
 * @returns Distancia en kilómetros
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // Radio de la Tierra en kilómetros
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // Redondear a 2 decimales para mayor legibilidad
  return Math.round((R * c) * 100) / 100;
}

const resolver = {
  getNearbyPetPlaces: async (
    root: any,
    { input }: { input: { lat: number; lng: number; limit?: number; radius?: number } },
    context: KeystoneContext
  ) => {
    const { lat, lng, limit = 10, radius = 10 } = input;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return {
        success: false,
        message: "Latitud y longitud inválidas",
        petPlaces: [],
      };
    }
    const petPlaces = await context.sudo().query.PetPlace.findMany({
      query: `id name description 
        lat lng 
        address phone 
        website street 
        municipality state 
        country cp 
        views 
        types { id label value plural }
        services { id name }
        user { id name }
        isOpen
        pet_place_social_media { id }
        pet_place_likes { id }
        pet_place_schedules { id }
        pet_place_reviews { id }
        pet_place_ads { id }
        google_place_id
        google_opening_hours
        createdAt
      `,
    });
    
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
    const result = withDistance.slice(0, limit);
    
    return {
      success: true,
      message: "PetPlaces encontrados",
      petPlaces: result,
    };
  },
};

export default { typeDefs, definition, resolver }; 