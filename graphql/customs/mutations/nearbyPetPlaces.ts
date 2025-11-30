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

/**
 * Crea un PetPlace desde un resultado de Google Places API
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

  // Verificar si ya existe
  const existingPlace = await context.sudo().query.PetPlace.findOne({
    where: { google_place_id: placeId },
    query: 'id',
  });

  if (existingPlace) {
    console.log(`Lugar con placeId ${placeId} ya registrado, se omite.`);
    return null;
  }

  // Buscar o crear el PetPlaceType
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
      console.error(`Tipo ${type} no encontrado en TYPES_PET_SHELTER`);
      return null;
    }
  }

  // Crear el PetPlace
  const result = await context.sudo().query.PetPlace.createOne({
    data: {
      name: place.name,
      description: `Lugar ubicado en ${address}. ${rating > 0 ? `Calificación: ${rating}/5 (${userRatingsTotal} reseñas)` : ''}`,
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

  // Obtener detalles adicionales si hay placeId
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

          // Crear reviews si existen
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
                console.error(`Error guardando review para ${place.name}:`, reviewError);
              }
            }
          }
        }
      }
    } catch (detailsError) {
      console.error(`Error obteniendo detalles para ${place.name}:`, detailsError);
    }
  }

  return result;
}

/**
 * Busca lugares en Google Places API por latitud y longitud
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
    throw new Error('GOOGLE_MAPS_API_KEY no está configurada en las variables de entorno');
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
  
  // Convertir radio de km a metros para la API de Google
  const radiusInMeters = Math.round(radius * 1000);
  
  // Usar Nearby Search API
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusInMeters}&keyword=${encodeURIComponent(searchTerm)}&key=${apiKey}&language=es`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error en la respuesta de la API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Error en la API de Google Places: ${data.status} - ${data.error_message || 'Error desconocido'}`);
    }

    if (!data.results || data.results.length === 0) {
      return [];
    }

    // Crear los lugares en la base de datos
    const createdPlaces = [];
    for (const place of data.results.slice(0, limit)) {
      try {
        const createdPlace = await createPetPlaceFromGoogleResult(place, type, apiKey, context);
        if (createdPlace) {
          createdPlaces.push(createdPlace);
        }
      } catch (error) {
        console.error(`Error creando lugar ${place.name}:`, error);
      }
    }

    return createdPlaces;
  } catch (error) {
    console.error('Error buscando lugares en Google Places:', error);
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
        message: "Latitud y longitud inválidas",
        petPlaces: [],
      };
    }

    // Buscar lugares en la base de datos
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

    console.log('result ++++++++++++++++++++++++++++++++++++++++++++++++++++++');

    if (result.length === 0 && type) {
      try {
        console.log(`No se encontraron lugares en la BD, buscando en Google Places para tipo: ${type}`);

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
        console.error('Error buscando en Google Places:', error);
      }
    }
    
    return {
      success: true,
      message: result.length > 0 ? "PetPlaces encontrados" : "No se encontraron PetPlaces",
      petPlaces: result,
    };
  },
};

export default { typeDefs, definition, resolver }; 