import { Prisma } from "@prisma/client";

/**
 * Reportes de animales con su última bitácora, filtrados, ordenados y paginados en Postgres.
 *
 * Antes `getNearbyAnimals` traía todos los animales y todas sus bitácoras a Node y filtraba en
 * memoria: pedir 10 costaba lo mismo que pedir 500. Ahora:
 * - la última bitácora de cada animal sale con un `LATERAL` que usa el índice de `AnimalLog.animal`;
 * - estado, tipo, raza y texto de lugar se filtran en el `WHERE`;
 * - con ubicación, primero un recuadro de lat/lng (barato) y luego la distancia exacta (haversine,
 *   en km, igual que `haversineDistance`);
 * - `LIMIT`/`OFFSET` en la base, y el total con `COUNT(*) OVER()` en la misma consulta.
 *
 * La última bitácora es la de `createdAt` más reciente (como antes en `getNearbyAnimals`).
 */

export type NearbyAnimalsFilters = {
  lat?: number | null;
  lng?: number | null;
  /** km */
  radius?: number | null;
  animalType?: string | null;
  breed?: string | null;
  status?: string | null;
  /** Texto libre: ciudad, estado, país o dirección (sin distinguir mayúsculas). */
  location?: string | null;
};

export type NearbyAnimalRow = {
  id: string;
  slug: string | null;
  name: string;
  sex: string | null;
  createdAt: Date | null;
  typeId: string | null;
  typeName: string | null;
  breedId: string | null;
  breedName: string | null;
  status: string;
  lat: string;
  lng: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  placeLabel: string | null;
  /** km; null sin ubicación de quien busca. */
  distance: number | null;
};

const EARTH_KM = 6371;
const KM_PER_DEGREE = 111.32;
/** Solo números decimales simples; cualquier otra cosa en `lat`/`lng` (vacío, texto) no cuenta. */
const COORD_PATTERN = "^-?[0-9]+([.][0-9]+)?$";

function hasPoint(filters: NearbyAnimalsFilters): filters is NearbyAnimalsFilters & { lat: number; lng: number } {
  return (
    typeof filters.lat === "number" &&
    typeof filters.lng === "number" &&
    Number.isFinite(filters.lat) &&
    Number.isFinite(filters.lng)
  );
}

function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function queryNearbyAnimals(
  prisma: any,
  filters: NearbyAnimalsFilters,
  page: { limit: number; skip: number },
): Promise<{ rows: NearbyAnimalRow[]; total: number }> {
  const point = hasPoint(filters) ? filters : null;
  const radius = Math.max(0.1, filters.radius ?? 10);

  const animalFilters: Prisma.Sql[] = [];
  if (filters.animalType) animalFilters.push(Prisma.sql`AND a."animal_type" = ${filters.animalType}`);
  if (filters.breed) animalFilters.push(Prisma.sql`AND a."animal_breed" = ${filters.breed}`);

  const scopedFilters: Prisma.Sql[] = [];
  if (filters.status) scopedFilters.push(Prisma.sql`AND status = ${filters.status}`);
  const location = filters.location?.trim();
  if (location) {
    const like = `%${escapeLike(location)}%`;
    scopedFilters.push(
      Prisma.sql`AND (city ILIKE ${like} OR state ILIKE ${like} OR country ILIKE ${like} OR address ILIKE ${like})`,
    );
  }

  let distance = Prisma.sql`NULL::float8`;
  let order = Prisma.sql`"createdAt" DESC NULLS LAST, id`;
  if (point) {
    const latDelta = radius / KM_PER_DEGREE;
    const lngDelta = radius / (KM_PER_DEGREE * Math.max(0.01, Math.cos((point.lat * Math.PI) / 180)));
    scopedFilters.push(
      Prisma.sql`AND lat_n BETWEEN ${point.lat - latDelta} AND ${point.lat + latDelta}
                 AND lng_n BETWEEN ${point.lng - lngDelta} AND ${point.lng + lngDelta}`,
    );
    distance = Prisma.sql`(${EARTH_KM} * 2 * asin(sqrt(
      power(sin(radians(lat_n - ${point.lat}) / 2), 2) +
      cos(radians(${point.lat})) * cos(radians(lat_n)) * power(sin(radians(lng_n - ${point.lng}) / 2), 2)
    )))`;
    order = Prisma.sql`distance ASC, id`;
  }
  const radiusFilter = point ? Prisma.sql`WHERE distance <= ${radius}` : Prisma.empty;

  const rows = await prisma.$queryRaw`
    WITH base AS (
      SELECT a.id, a.slug, a.name, a.sex, a."createdAt",
             t.id AS "typeId", t.name AS "typeName", b.id AS "breedId", b.breed AS "breedName",
             last.status, last.lat, last.lng, last.address, last.city, last.state, last.country,
             last."placeLabel",
             CASE WHEN last.lat ~ ${COORD_PATTERN} AND last.lng ~ ${COORD_PATTERN}
                  THEN last.lat::float8 END AS lat_n,
             CASE WHEN last.lat ~ ${COORD_PATTERN} AND last.lng ~ ${COORD_PATTERN}
                  THEN last.lng::float8 END AS lng_n
      FROM "Animal" a
      JOIN LATERAL (
        SELECT l.status, l.lat, l.lng, l.address, l.city, l.state, l.country, l."placeLabel"
        FROM "AnimalLog" l
        WHERE l."animal" = a.id
        ORDER BY l."createdAt" DESC NULLS LAST
        LIMIT 1
      ) last ON true
      LEFT JOIN "AnimalType" t ON t.id = a."animal_type"
      LEFT JOIN "AnimalBreed" b ON b.id = a."animal_breed"
      WHERE a."duplicateOf" IS NULL AND a."inactiveAt" IS NULL
      ${Prisma.join(animalFilters.length ? animalFilters : [Prisma.empty], " ")}
    ),
    scoped AS (
      SELECT *, ${distance} AS distance
      FROM base
      WHERE TRUE ${Prisma.join(scopedFilters.length ? scopedFilters : [Prisma.empty], " ")}
    )
    SELECT id, slug, name, sex, "createdAt", "typeId", "typeName", "breedId", "breedName",
           status, lat, lng, address, city, state, country, "placeLabel", distance,
           COUNT(*) OVER()::int AS total
    FROM scoped
    ${radiusFilter}
    ORDER BY ${order}
    LIMIT ${page.limit}::int OFFSET ${page.skip}::int
  `;
  // Prisma de Keystone devuelve el error en vez de lanzarlo.
  if (rows instanceof Error) throw rows;

  const list = rows as Array<NearbyAnimalRow & { total: number }>;
  let total = list[0]?.total ?? 0;
  // Página fuera de rango: no hay filas de donde leer el total.
  if (list.length === 0 && page.skip > 0) {
    total = (await queryNearbyAnimals(prisma, filters, { limit: 1, skip: 0 })).total;
  }
  return {
    rows: list.map(({ total: _total, ...row }) => ({
      ...row,
      distance: row.distance == null ? null : Math.round(Number(row.distance) * 100) / 100,
    })),
    total,
  };
}
