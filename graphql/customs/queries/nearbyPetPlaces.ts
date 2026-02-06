import { KeystoneContext } from "@keystone-6/core/types";
import { TYPES_PET_SHELTER } from '../../../utils/constants/constants';
import { haversineDistance } from "../../../utils/helpers/calculate_distances";
import { dayNames } from "../../../models/Schedule/Schedule";

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
    lat: Float!
    lng: Float!
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

/**
 * Parses address_components from Google Places API and extracts location fields
 */
function parseAddressComponents(addressComponents: any[]): {
  street: string;
  municipality: string;
  state: string;
  country: string;
  cp: string;
} {
  const result = {
    street: '',
    municipality: '',
    state: '',
    country: '',
    cp: '',
  };

  if (!Array.isArray(addressComponents)) {
    return result;
  }

  let streetNumber = '';
  let route = '';

  for (const component of addressComponents) {
    const types = component.types || [];
    const longName = component.long_name || '';

    if (types.includes('street_number')) {
      streetNumber = longName;
    }
    if (types.includes('route')) {
      route = longName;
    }
    if (types.includes('locality')) {
      result.municipality = longName;
    }
    if (types.includes('administrative_area_level_1')) {
      result.state = longName;
    }
    if (types.includes('country')) {
      result.country = longName;
    }
    if (types.includes('postal_code')) {
      result.cp = longName;
    }
  }

  // Combine street_number and route
  if (streetNumber && route) {
    result.street = `${streetNumber} ${route}`.trim();
  } else if (streetNumber) {
    result.street = streetNumber;
  } else if (route) {
    result.street = route;
  }

  return result;
}

/**
 * Converts Google Places time format (HHMM string) to hours (0-23)
 */
function convertGoogleTimeToHours(timeString: string): number {
  if (!timeString || timeString.length !== 4) {
    return 0;
  }
  const hours = parseInt(timeString.substring(0, 2), 10);
  return isNaN(hours) ? 0 : hours;
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
  
  // Parse address_components if available
  const addressData = place.address_components
    ? parseAddressComponents(place.address_components)
    : { street: '', municipality: '', state: '', country: '', cp: '' };

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
      street: addressData.street,
      municipality: addressData.municipality,
      state: addressData.state,
      country: addressData.country,
      cp: addressData.cp,
      lat: lat,
      lng: lng,
      views: 0,
      address: address,
      google_place_id: placeId,
    },
  });

  if (placeId) {
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=review,opening_hours,international_phone_number,address_components&key=${apiKey}&language=es`;
      const detailsResponse = await fetch(detailsUrl);
      
      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();

        if (detailsData.status === 'OK' && detailsData.result) {
          const updateData: any = {};
          
          // Update phone
          if (detailsData.result.international_phone_number) {
            updateData.phone = detailsData.result.international_phone_number;
          }
          
          // Update address components if available
          if (detailsData.result.address_components) {
            const addressData = parseAddressComponents(detailsData.result.address_components);
            if (addressData.street) updateData.street = addressData.street;
            if (addressData.municipality) updateData.municipality = addressData.municipality;
            if (addressData.state) updateData.state = addressData.state;
            if (addressData.country) updateData.country = addressData.country;
            if (addressData.cp) updateData.cp = addressData.cp;
          }
          
          // Update opening hours text
          if (
            detailsData.result.opening_hours &&
            Array.isArray(detailsData.result.opening_hours.weekday_text)
          ) {
            updateData.google_opening_hours = detailsData.result.opening_hours.weekday_text.join('\n');
          }
          
          // Update PetPlace with address and phone data
          if (Object.keys(updateData).length > 0) {
            await context.sudo().query.PetPlace.updateOne({
              where: { id: result.id },
              data: updateData,
            });
          }

          // Create schedules from opening_hours periods
          if (
            detailsData.result.opening_hours &&
            Array.isArray(detailsData.result.opening_hours.periods)
          ) {
            for (const period of detailsData.result.opening_hours.periods) {
              try {
                if (period.open && period.close) {
                  const day = period.open.day; // 0-6 (Sunday to Saturday)
                  const openTime = convertGoogleTimeToHours(period.open.time);
                  const closeTime = convertGoogleTimeToHours(period.close.time);
                  
                  // Map Google day (0-6) to our dayOfWeek enum values
                  const dayName = dayNames[day];
                  
                  if (dayName) {
                    await context.sudo().query.Schedule.createOne({
                      data: {
                        day: dayName,
                        timeIni: openTime,
                        timeEnd: closeTime,
                        pet_place: { connect: { id: result.id } },
                      },
                    });
                  }
                }
              } catch (scheduleError) {
                console.error(`Error saving schedule for ${place.name}:`, scheduleError);
              }
            }
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
        pet_place_ads { id }
        google_place_id
        google_opening_hours
        reviewsCount
        averageRating
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
              pet_place_ads { id }
              google_place_id
              google_opening_hours
              reviewsCount
              averageRating
              createdAt
            `,
          });

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