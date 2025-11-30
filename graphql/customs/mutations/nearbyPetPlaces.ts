import { KeystoneContext } from "@keystone-6/core/types";
import { TYPES_PET_SHELTER } from '../../../utils/constants/constants';

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
    type: String
  }

  type Mutation {
    getNearbyPetPlaces(input: NearbyPetPlacesInput!): NearbyPetPlacesResult!
  }
`;

const definition = `
  getNearbyPetPlaces(input: NearbyPetPlacesInput!): NearbyPetPlacesResult!
`;

/**
 * Calculates the distance between two geographic points using the Haversine formula
 * @param lat1 Latitude of the first point
 * @param lng1 Longitude of the first point
 * @param lat2 Latitude of the second point
 * @param lng2 Longitude of the second point
 * @returns Distance in kilometers
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // Round to 2 decimal places for better readability
  return Math.round((R * c) * 100) / 100;
}

/**
 * Creates a PetPlace from a Google Places API result
 */
async function createPetPlaceFromGoogleResult(
  place: any,
  type: string,
  apiKey: string,
  context: KeystoneContext
): Promise<any> {
  if (!place.name) {
    return null;
  }

  const address = place.formatted_address || '';
  const lat = place.geometry?.location?.lat?.toString() || '';
  const lng = place.geometry?.location?.lng?.toString() || '';
  const rating = place.rating || 0;
  const userRatingsTotal = place.user_ratings_total || 0;
  const placeId = place.place_id || '';

  // Check if it already exists
  const existingPlace = await context.sudo().query.PetPlace.findOne({
    where: { google_place_id: placeId },
    query: 'id',
  });

  if (existingPlace) {
    console.log(`Place with placeId ${placeId} already registered, skipping.`);
    return null;
  }

  let petPlaceType = await context.sudo().query.PetPlaceType.findOne({
    where: { value: type },
    query: 'id',
  });

  if (!petPlaceType) {
    const typeData = TYPES_PET_SHELTER.find(t => t.value === type);
    if (typeData) {
      petPlaceType = await context.sudo().query.PetPlaceType.createOne({
        data: {
          label: typeData.label,
          value: typeData.value,
          plural: typeData.plural,
        },
      });
    } else {
      console.error(`Type ${type} not found in TYPES_PET_SHELTER`);
      return null;
    }
  }

  const result = await context.sudo().query.PetPlace.createOne({
    data: {
      name: place.name,
      description: `Place located at ${address}. ${rating > 0 ? `Rating: ${rating}/5 (${userRatingsTotal} reviews)` : ''}`,
      types: { connect: [{ id: petPlaceType.id }] },
      phone: '',
      website: '',
      street: '',
      municipality: '',
      state: '',
      country: '',
      cp: '',
      lat: lat,
      lng: lng,
      views: 0,
      address: address,
      google_place_id: placeId,
    },
  });

  if (placeId) {
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=review,opening_hours,international_phone_number&key=${apiKey}&language=es`;
      const detailsResponse = await fetch(detailsUrl);
      
      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();

        if (detailsData.status === 'OK' && detailsData.result) {
          const updateData: any = {};
          if (detailsData.result.international_phone_number) {
            updateData.phone = detailsData.result.international_phone_number;
          }
          if (
            detailsData.result.opening_hours &&
            Array.isArray(detailsData.result.opening_hours.weekday_text)
          ) {
            updateData.google_opening_hours = detailsData.result.opening_hours.weekday_text.join('\n');
          }
          if (Object.keys(updateData).length > 0) {
            await context.sudo().query.PetPlace.updateOne({
              where: { id: result.id },
              data: updateData,
            });
          }

          // Create reviews if they exist
          if (Array.isArray(detailsData.result.reviews)) {
            for (const review of detailsData.result.reviews) {
              try {
                let createdAt: Date | undefined = undefined;
                if (review.time) {
                  createdAt = new Date(review.time * 1000);
                }
                await context.sudo().query.Review.createOne({
                  data: {
                    rating: review.rating || 0,
                    review: review.text || '',
                    createdAt: createdAt,
                    google_user: review.author_name || '',
                    google_user_photo: review.profile_photo_url || '',
                    pet_place: { connect: { id: result.id } },
                  },
                });
              } catch (reviewError) {
                console.error(`Error saving review for ${place.name}:`, reviewError);
              }
            }
          }
        }
      }
    } catch (detailsError) {
      console.error(`Error getting details for ${place.name}:`, detailsError);
    }
  }

  return result;
}

/**
 * Searches for places in Google Places API by latitude and longitude
 */
async function searchPlacesByLocation(
  lat: number,
  lng: number,
  type: string,
  radius: number,
  limit: number,
  context: KeystoneContext
): Promise<any[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured in environment variables');
  }

  // Map type to search query
  const typeLabels: { [key: string]: string } = {
    'veterinary': 'veterinarias',
    'pet_shelter': 'refugios de animales',
    'pet_store': 'tiendas de mascotas',
    'pet_boarding': 'hoteles para mascotas guarderías',
    'pet_park': 'parques para perros',
    'other': 'lugares para mascotas'
  };

  const searchTerm = typeLabels[type] || 'lugares para mascotas';
  
  // Convert radius from km to meters for Google API
  const radiusInMeters = Math.round(radius * 1000);
  
  // Use Nearby Search API
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusInMeters}&keyword=${encodeURIComponent(searchTerm)}&key=${apiKey}&language=es`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API response error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    if (!data.results || data.results.length === 0) {
      return [];
    }

    // Create places in the database
    const createdPlaces = [];
    for (const place of data.results.slice(0, limit)) {
      try {
        const createdPlace = await createPetPlaceFromGoogleResult(place, type, apiKey, context);
        if (createdPlace) {
          createdPlaces.push(createdPlace);
        }
      } catch (error) {
        console.error(`Error creating place ${place.name}:`, error);
      }
    }

    return createdPlaces;
  } catch (error) {
    console.error('Error searching places in Google Places:', error);
    return [];
  }
}

const resolver = {
  getNearbyPetPlaces: async (
    root: any,
    { input }: { input: { lat: number; lng: number; limit?: number; radius?: number; type?: string } },
    context: KeystoneContext
  ) => {
    const { lat, lng, limit = 10, radius = 10, type } = input;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return {
        success: false,
        message: "Invalid latitude and longitude",
        petPlaces: [],
      };
    }

    // Search for places in the database
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
    let result = withDistance.slice(0, limit);

    if (result.length === 0 && type) {
      try {
        console.log(`No places found in database, searching in Google Places for type: ${type}`);

        const createdPlaces = await searchPlacesByLocation(lat, lng, type, radius, limit, context);        
        
        if (createdPlaces.length > 0) {
          const createdPlaceIds = createdPlaces.map(p => p.id);
          const fullCreatedPlaces = await context.sudo().query.PetPlace.findMany({
            where: { id: { in: createdPlaceIds } },
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

          result = fullCreatedPlaces
            .map((place: any) => {
              const placeLat = parseFloat(place.lat);
              const placeLng = parseFloat(place.lng);
              if (isNaN(placeLat) || isNaN(placeLng)) return null;
              const distance = haversineDistance(lat, lng, placeLat, placeLng);
              return { ...place, distance };
            })
            .filter((place: any) => place && place.distance <= radius)
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, limit);
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