import { KeystoneContext } from "@keystone-6/core/types";
import { persistPetPlaceSlugIfMissing } from "../../models/Pet/PetPlace/PetPlace.hooks";
import { dayNames } from "../../models/Pet/Schedule/Schedule";
import { TYPES_PET_SHELTER } from "../constants/constants";
import { haversineDistance } from "./calculate_distances";

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
 * Parses address_components from Google Places API and extracts location fields
 */
export function parseAddressComponents(addressComponents: any[]): {
  street: string;
  municipality: string;
  state: string;
  country: string;
  cp: string;
} {
  const result = {
    street: "",
    municipality: "",
    state: "",
    country: "",
    cp: "",
  };

  if (!Array.isArray(addressComponents)) {
    return result;
  }

  let streetNumber = "";
  let route = "";

  for (const component of addressComponents) {
    const types = component.types || [];
    const longName = component.long_name || "";

    if (types.includes("street_number")) {
      streetNumber = longName;
    }
    if (types.includes("route")) {
      route = longName;
    }
    if (types.includes("locality")) {
      result.municipality = longName;
    }
    if (types.includes("administrative_area_level_1")) {
      result.state = longName;
    }
    if (types.includes("country")) {
      result.country = longName;
    }
    if (types.includes("postal_code")) {
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

/** Google cobra cada Nearby Search y cada Place Details, así que se piden lo menos posible. */
const GOOGLE_AREA_CELL_DEG = 0.05; // ~5.5 km
const GOOGLE_AREA_TTL_DAYS = 180;
const GOOGLE_MAX_RADIUS_KM = 10;
/** Si la BD ya tiene al menos esto en el radio, no se consulta Google. */
export const MIN_DB_RESULTS = 3;

const KM_PER_DEG_LAT = 111.32;
const NUMERIC_COORD = "^-?[0-9]+(\\.[0-9]+)?$";

/**
 * Creates a PetPlace from a Google Places API result.
 * Solo usa lo que ya trae la Nearby Search; teléfono, horario y reseñas los completa
 * fillPetPlaceFromGoogleDetails en segundo plano.
 */
async function createPetPlaceFromGoogleResult(
  place: any,
  type: string,
  context: KeystoneContext,
): Promise<any> {
  if (!place.name) {
    return null;
  }

  const address = place.formatted_address || place.vicinity || "";
  const lat = place.geometry?.location?.lat?.toString() || "";
  const lng = place.geometry?.location?.lng?.toString() || "";
  const rating = place.rating || 0;
  const userRatingsTotal = place.user_ratings_total || 0;
  const placeId = place.place_id || "";

  // No crear sin google_place_id para evitar duplicados y respetar unique en BD
  if (!placeId) {
    return null;
  }

  // Parse address_components if available
  const addressData = place.address_components
    ? parseAddressComponents(place.address_components)
    : { street: "", municipality: "", state: "", country: "", cp: "" };

  // Evitar duplicados: si ya existe un PetPlace con este google_place_id, no crear otro
  const existingPlace = await context.sudo().query.PetPlace.findOne({
    where: { google_place_id: placeId },
    query: "id",
  });
  if (existingPlace) {
    return null;
  }

  let petPlaceType = await context.sudo().query.PetPlaceType.findOne({
    where: { value: type },
    query: "id",
  });

  if (!petPlaceType) {
    const typeData = TYPES_PET_SHELTER.find((t) => t.value === type);
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

  return context.sudo().query.PetPlace.createOne({
    data: {
      name: place.name,
      description: `Place located at ${address}. ${rating > 0 ? `Rating: ${rating}/5 (${userRatingsTotal} reviews)` : ""}`,
      types: { connect: [{ id: petPlaceType.id }] },
      phone: "",
      website: "",
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
}

/**
 * Completa teléfono, dirección, horario y reseñas con Place Details.
 * Se llama una sola vez por lugar, justo después de crearlo.
 */
async function fillPetPlaceFromGoogleDetails(
  petPlaceId: string,
  placeId: string,
  placeName: string,
  apiKey: string,
  context: KeystoneContext,
): Promise<void> {
  try {
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=review,opening_hours,international_phone_number,address_components&key=${apiKey}&language=es`;
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) return;

    const detailsData = await detailsResponse.json();
    if (detailsData.status !== "OK" || !detailsData.result) return;

    const updateData: any = {};

    // Update phone
    if (detailsData.result.international_phone_number) {
      updateData.phone = detailsData.result.international_phone_number;
    }

    // Update address components if available
    if (detailsData.result.address_components) {
      const addressData = parseAddressComponents(
        detailsData.result.address_components,
      );
      if (addressData.street) updateData.street = addressData.street;
      if (addressData.municipality)
        updateData.municipality = addressData.municipality;
      if (addressData.state) updateData.state = addressData.state;
      if (addressData.country) updateData.country = addressData.country;
      if (addressData.cp) updateData.cp = addressData.cp;
    }

    // Update opening hours text
    if (
      detailsData.result.opening_hours &&
      Array.isArray(detailsData.result.opening_hours.weekday_text)
    ) {
      updateData.google_opening_hours =
        detailsData.result.opening_hours.weekday_text.join("\n");
    }

    // Update PetPlace with address and phone data
    if (Object.keys(updateData).length > 0) {
      await context.sudo().query.PetPlace.updateOne({
        where: { id: petPlaceId },
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
                  pet_place: { connect: { id: petPlaceId } },
                },
              });
            }
          }
        } catch (scheduleError) {
          console.error(
            `Error saving schedule for ${placeName}:`,
            scheduleError,
          );
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
              review: review.text || "",
              createdAt: createdAt,
              google_user: review.author_name || "",
              google_user_photo: review.profile_photo_url || "",
              pet_place: { connect: { id: petPlaceId } },
            },
          });
        } catch (reviewError) {
          console.error(
            `Error saving review for ${placeName}:`,
            reviewError,
          );
        }
      }
    }
  } catch (detailsError) {
    console.error(`Error getting details for ${placeName}:`, detailsError);
  }
}

/**
 * Searches for places in Google Places API by latitude and longitude.
 * Lanza error si Google falla, para que la zona no quede marcada como buscada.
 * Devuelve cuántos resultados dio Google y los PetPlace nuevos que se crearon.
 */
export async function searchPlacesByLocation(
  lat: number,
  lng: number,
  type: string,
  radius: number,
  context: KeystoneContext,
): Promise<{ googleResults: number; created: any[] }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_MAPS_API_KEY is not configured in environment variables",
    );
  }

  // Map type to search query
  const typeLabels: { [key: string]: string } = {
    veterinary: "veterinarias",
    pet_shelter: "refugios de animales",
    pet_store: "tiendas de mascotas",
    pet_boarding: "hoteles para mascotas guarderías",
    pet_park: "parques para perros",
    other: "lugares para mascotas",
  };

  const searchTerm = typeLabels[type] || "lugares para mascotas";

  // Convert radius from km to meters for Google API
  const radiusInMeters = Math.round(radius * 1000);

  // Use Nearby Search API (una sola página: hasta 20 resultados por cobro)
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusInMeters}&keyword=${encodeURIComponent(searchTerm)}&key=${apiKey}&language=es`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `API response error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(
      `Google Places API error: ${data.status} - ${data.error_message || "Unknown error"}`,
    );
  }

  const results: any[] = Array.isArray(data.results) ? data.results : [];

  // Create places in the database
  const created = [];
  for (const place of results) {
    try {
      const createdPlace = await createPetPlaceFromGoogleResult(
        place,
        type,
        context,
      );
      if (createdPlace) {
        created.push({ ...createdPlace, placeId: place.place_id, name: place.name });
      }
    } catch (error) {
      console.error(`Error creating place ${place.name}:`, error);
    }
  }

  // Los detalles no bloquean la respuesta; se completan en segundo plano.
  void (async () => {
    for (const place of created) {
      await fillPetPlaceFromGoogleDetails(
        place.id,
        place.placeId,
        place.name,
        apiKey,
        context,
      );
    }
  })();

  return { googleResults: results.length, created };
}

function areaKey(type: string, lat: number, lng: number) {
  const cellLat = Math.round(lat / GOOGLE_AREA_CELL_DEG) * GOOGLE_AREA_CELL_DEG;
  const cellLng = Math.round(lng / GOOGLE_AREA_CELL_DEG) * GOOGLE_AREA_CELL_DEG;
  return `${type}:${cellLat.toFixed(2)}:${cellLng.toFixed(2)}`;
}

/** Búsquedas a Google en curso por zona, para que dos peticiones a la vez paguen una sola. */
const inFlightAreaSearches = new Map<string, Promise<boolean>>();

/**
 * Busca la zona en Google solo si no se buscó antes (o caducó, o ahora se pide un radio mayor).
 * Devuelve true si consultó Google.
 */
export async function ensureAreaSearchedOnGoogle(
  context: KeystoneContext,
  { lat, lng, type, radiusKm }: { lat: number; lng: number; type: string; radiusKm: number },
): Promise<boolean> {
  const key = areaKey(type, lat, lng);
  const radius = Math.min(radiusKm, GOOGLE_MAX_RADIUS_KM);

  const inFlight = inFlightAreaSearches.get(key);
  if (inFlight) return inFlight;

  const run = (async () => {
    const area = await context.sudo().query.PetPlaceSearchArea.findOne({
      where: { key },
      query: "id radiusKm searchedAt",
    });
    const ttlMs = GOOGLE_AREA_TTL_DAYS * 24 * 60 * 60 * 1000;
    const isFresh =
      area?.searchedAt && Date.now() - new Date(area.searchedAt).getTime() < ttlMs;
    if (isFresh && (area.radiusKm ?? 0) >= radius) return false;

    const { googleResults } = await searchPlacesByLocation(lat, lng, type, radius, context);

    const data = { type, lat, lng, radiusKm: radius, googleResults, searchedAt: new Date().toISOString() };
    if (area) {
      await context.sudo().query.PetPlaceSearchArea.updateOne({ where: { id: area.id }, data });
    } else {
      await context.sudo().query.PetPlaceSearchArea.createOne({ data: { key, ...data } });
    }
    return true;
  })();

  inFlightAreaSearches.set(key, run);
  try {
    return await run;
  } finally {
    inFlightAreaSearches.delete(key);
  }
}

/**
 * PetPlaces de la BD dentro del radio, ordenados por distancia.
 * Primero filtra por un recuadro en SQL (lat/lng se guardan como texto) y luego calcula la distancia exacta.
 */
export async function findPetPlacesNear(
  context: KeystoneContext,
  { lat, lng, radiusKm, type }: { lat: number; lng: number; radiusKm: number; type?: string },
): Promise<any[]> {
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLng = radiusKm / (KM_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

  const rows: { id: string }[] = await context.sudo().prisma.$queryRaw`
    SELECT id FROM "PetPlace"
    WHERE (CASE WHEN lat ~ ${NUMERIC_COORD} THEN lat::double precision END)
            BETWEEN ${lat - dLat} AND ${lat + dLat}
      AND (CASE WHEN lng ~ ${NUMERIC_COORD} THEN lng::double precision END)
            BETWEEN ${lng - dLng} AND ${lng + dLng}
  `;
  if (!rows.length) return [];

  const where: any = { id: { in: rows.map((row) => row.id) } };
  if (type) where.types = { some: { value: { equals: type } } };

  const places = await getPetPlacesHelper(context, where);
  return places
    .map((place: any) => {
      const placeLat = parseFloat(place.lat);
      const placeLng = parseFloat(place.lng);
      if (isNaN(placeLat) || isNaN(placeLng)) return null;
      return { ...place, distance: haversineDistance(lat, lng, placeLat, placeLng) };
    })
    .filter((place: any) => place && place.distance <= radiusKm)
    .sort((a: any, b: any) => a.distance - b.distance);
}

// Search for places in the database
export async function getPetPlacesHelper(
  context: KeystoneContext,
  whereClause: any,
) {
  const places = await context.sudo().query.PetPlace.findMany({
    where: whereClause,
    query: `id name slug description 
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
          verified
          createdAt
        `,
  });

  const filled = [];
  for (const place of places) {
    const id = typeof place.id === "string" ? place.id : "";
    if (!id) {
      filled.push(place);
      continue;
    }
    if (place.slug) {
      filled.push(place);
      continue;
    }
    const slug = await persistPetPlaceSlugIfMissing(
      {
        id,
        name: place.name,
        slug: place.slug,
        municipality: place.municipality,
        state: place.state,
      },
      context,
    );
    filled.push(slug ? { ...place, slug } : place);
  }
  return filled;
}
