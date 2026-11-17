/**
 * «Lo vi»: alguien (con o sin cuenta) avisa que vio a un animal reportado. Se publica al momento en
 * la ficha y se avisa a quien atiende el reporte. Ver `graphql/customs/mutations/pet/animalSightings.ts`.
 */

/** Solo tiene sentido avisar que lo viste si el animal sigue en la calle. */
export const SIGHTING_STATUSES = ["lost", "abandoned"];

export const SIGHTING_NOTES_MAX = 500;
export const SIGHTING_NAME_MAX = 60;
export const SIGHTING_PHONE_MAX = 20;
export const SIGHTING_PLACE_MAX = 200;

/** Un avistamiento de hace más de esto no ayuda a buscar: se rechaza. */
export const SIGHTING_MAX_AGE_DAYS = 30;

/** La misma IP no puede avisar dos veces del mismo animal en este lapso (doble clic, reintentos). */
export const SIGHTING_DEDUPE_MINUTES = 10;

/** Cuántos avistamientos lee la ficha (los más recientes). */
export const SIGHTINGS_DEFAULT_TAKE = 20;
export const SIGHTINGS_MAX_TAKE = 50;

/** En el mapa de `/animales` (`getNearbyAnimals`): avistamientos de las últimas 72 h, hasta 3 por animal. */
export const MAP_SIGHTING_HOURS = 72;
export const MAP_SIGHTINGS_PER_ANIMAL = 3;
