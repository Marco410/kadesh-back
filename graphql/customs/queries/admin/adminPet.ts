import type { KeystoneContext } from "@keystone-6/core/types";
import { Role } from "../../../../models/Role/constants";
import { ANIMAL_LOGS_OPTIONS } from "../../../../utils/constants/constants";
import { PRODUCT } from "../../../../utils/constants/product";
import {
  adminPrisma,
  assertPlatformAdmin,
  clampInt,
  daysAgo,
  toMxDay,
  unwrapPrisma,
} from "./shared";

/**
 * Resumen de Kadesh Pet en Operaciones (Kadesh Pet → Resumen): cifras de animales, veterinarias,
 * usuarios de Pet, interacción y pendientes, y series por día, semana o mes. Solo admin de
 * plataforma.
 *
 * Reglas (ver README de esta carpeta):
 * - Estatus de un animal = su registro más reciente en la bitácora (`AnimalLog`), por
 *   `date_status` y luego `createdAt`: el mismo orden que `adminAnimals` y `petLandingStats`.
 *   Bitácoras viejas guardan la etiqueta "Registrado" (se cuenta como `register`); sin bitácora o
 *   con un valor desconocido = `none`.
 * - Los duplicados fusionados (`duplicateOf`) no cuentan en nada; se devuelven aparte.
 * - Origen "admin" = quien lo publicó tiene el rol admin, igual que el filtro "Publicado por".
 * - Usuarios de Pet = `product = pet`, sin empresa (las cuentas de Negocios anteriores al campo
 *   quedaron como `pet`) y sin cuentas de prueba.
 * - Días, semanas (de lunes) y meses en hora de CDMX.
 */

const typeDefs = `
  type AdminPetTopAnimal {
    id: ID!
    name: String!
    slug: String
    status: String
    coverUrl: String
    views: Int!
  }

  type AdminPetAnimalsSummary {
    total: Int!
    newInPeriod: Int!
    newPrevPeriod: Int!
    facebookPublished: Int!
    facebookPending: Int!
    duplicatesMerged: Int!
    byStatus: [AdminCount!]!
    byType: [AdminCount!]!
    byOrigin: [AdminCount!]!
    byReportedBy: [AdminCount!]!
    topStates: [AdminCount!]!
    topCities: [AdminCount!]!
  }

  type AdminPetPlacesSummary {
    total: Int!
    veterinaries: Int!
    verified: Int!
    fromGoogle: Int!
    reviews: Int!
    likes: Int!
    newInPeriod: Int!
    newPrevPeriod: Int!
    byClaimStatus: [AdminCount!]!
    byType: [AdminCount!]!
    topStates: [AdminCount!]!
  }

  type AdminPetUsersSummary {
    total: Int!
    newInPeriod: Int!
    newPrevPeriod: Int!
  }

  type AdminPetEngagement {
    views: Int!
    viewsSignedIn: Int!
    favorites: Int!
    comments: Int!
    topViewed: [AdminPetTopAnimal!]!
  }

  type AdminPetPending {
    animalClaims: Int!
    placeClaims: Int!
    services: Int!
    facebookPending: Int!
  }

  type AdminPetSummary {
    days: Int
    animals: AdminPetAnimalsSummary!
    places: AdminPetPlacesSummary!
    users: AdminPetUsersSummary!
    engagement: AdminPetEngagement!
    pending: AdminPetPending!
    generatedAt: String!
  }

  input AdminPetSummaryInput {
    days: Int
  }

  input AdminPetSeriesInput {
    metric: String!
    granularity: String
    range: String
    breakdown: String
    placeType: String
  }

  type AdminPetSeriesPoint {
    bucket: String!
    total: Int!
    segments: [AdminCount!]!
  }

  type AdminPetSeries {
    metric: String!
    granularity: String!
    breakdown: String!
    from: String!
    to: String!
    total: Int!
    points: [AdminPetSeriesPoint!]!
  }
`;

const definition = `
  adminPetSummary(input: AdminPetSummaryInput): AdminPetSummary!
  adminPetSeries(input: AdminPetSeriesInput!): AdminPetSeries!
`;

const METRICS = ["animals", "places_created", "places_claimed", "places_verified", "pet_users"] as const;
type Metric = (typeof METRICS)[number];

const GRANULARITIES = ["day", "week", "month"] as const;
type Granularity = (typeof GRANULARITIES)[number];

const BREAKDOWNS = ["none", "status", "origin"] as const;
type Breakdown = (typeof BREAKDOWNS)[number];

/** Rango → días hacia atrás desde hoy. `all` = desde el primer registro. */
const RANGE_DAYS: Record<string, number | null> = {
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
  all: null,
};

/** Con barras por día no se pide más de esto: más de 90 barras ya no se leen. */
const MAX_DAY_BUCKETS = 90;
const MAX_BUCKETS = 400;
const TOP_PLACES = 8;
const TOP_VIEWED = 5;

/** `ANIMAL_LOGS_OPTIONS` + `none` (sin bitácora o valor desconocido). */
const STATUS_KEYS = [...ANIMAL_LOGS_OPTIONS.map((option) => option.value), "none"];
const STATUS_BY_STORED = new Map<string, string>(
  ANIMAL_LOGS_OPTIONS.flatMap((option) => [
    [option.value, option.value],
    // El default viejo del campo era la etiqueta ("Registrado"), no el valor.
    [option.label, option.value],
  ]),
);

function normalizeStatus(stored: string | null | undefined): string {
  const value = stored?.trim();
  if (!value) return "none";
  return STATUS_BY_STORED.get(value) ?? "none";
}

/** Usuarios que cuentan como Kadesh Pet. */
const PET_USER_WHERE = { product: PRODUCT.PET, companyId: null, userTest: false };

// ---------------------------------------------------------------------------------------------
// Fechas `YYYY-MM-DD` (días calendario de CDMX) sin zona: se opera en UTC para no brincar días.

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number): string {
  const date = parseYmd(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return formatYmd(date);
}

/** Inicio del periodo que contiene `ymd`: el mismo día, el lunes (como `date_trunc('week')`) o el día 1. */
function bucketStart(ymd: string, granularity: Granularity): string {
  if (granularity === "day") return ymd;
  if (granularity === "month") return `${ymd.slice(0, 7)}-01`;
  const weekday = (parseYmd(ymd).getUTCDay() + 6) % 7; // lunes = 0
  return addDays(ymd, -weekday);
}

function nextBucket(ymd: string, granularity: Granularity): string {
  if (granularity === "day") return addDays(ymd, 1);
  if (granularity === "week") return addDays(ymd, 7);
  const date = parseYmd(ymd);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return formatYmd(date);
}

/** Inicio de un día de CDMX como texto UTC para comparar contra columnas `timestamp` (guardan UTC). */
function mxDayStartUtc(ymd: string): string {
  return new Date(`${ymd}T00:00:00.000-06:00`).toISOString().slice(0, 23).replace("T", " ");
}

function oneOf<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T, label: string): T {
  const clean = value?.trim();
  if (!clean) return fallback;
  if (!(allowed as readonly string[]).includes(clean)) {
    throw new Error(`Valor no válido para ${label}: ${clean}.`);
  }
  return clean as T;
}

// ---------------------------------------------------------------------------------------------

type SeriesRow = { bucket: string; segment: string; n: number };

async function adminUserIds(prisma: any): Promise<string[]> {
  const rows: Array<{ id: string }> = await prisma.user.findMany({
    where: { roles: { some: { name: Role.ADMIN } } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/** Primer día (CDMX) con datos de la métrica, para el rango "todo". */
async function firstDayOf(prisma: any, metric: Metric, placeType: string | null): Promise<string | null> {
  const placeWhere = placeType ? { types: { some: { value: placeType } } } : {};
  let value: Date | null = null;
  if (metric === "animals") {
    value = (await prisma.animal.aggregate({ where: { duplicateOfId: null }, _min: { createdAt: true } }))._min.createdAt;
  } else if (metric === "places_created") {
    value = (await prisma.petPlace.aggregate({ where: placeWhere, _min: { createdAt: true } }))._min.createdAt;
  } else if (metric === "places_claimed") {
    value = (await prisma.petPlace.aggregate({ where: placeWhere, _min: { claimedAt: true } }))._min.claimedAt;
  } else if (metric === "places_verified") {
    value = (await prisma.petPlace.aggregate({ where: placeWhere, _min: { verifiedAt: true } }))._min.verifiedAt;
  } else {
    value = (await prisma.user.aggregate({ where: PET_USER_WHERE, _min: { createdAt: true } }))._min.createdAt;
  }
  return value ? toMxDay(value) : null;
}

/**
 * Conteos por periodo. Cada métrica es su propia consulta (la columna de fecha no se puede
 * parametrizar); el periodo se arma en SQL en hora de CDMX y los vacíos se rellenan en JS.
 */
async function seriesRows(
  prisma: any,
  args: { metric: Metric; granularity: Granularity; breakdown: Breakdown; placeType: string | null; startUtc: string },
): Promise<SeriesRow[]> {
  const { metric, granularity: unit, breakdown, placeType, startUtc } = args;

  if (metric === "animals") {
    const adminIds = breakdown === "origin" ? await adminUserIds(prisma) : [];
    return unwrapPrisma(await prisma.$queryRaw`
      WITH latest AS (
        SELECT DISTINCT ON ("animal") "animal", status
        FROM "AnimalLog"
        WHERE "animal" IS NOT NULL
        ORDER BY "animal", "date_status" DESC NULLS LAST, "createdAt" DESC NULLS LAST
      )
      SELECT
        to_char(date_trunc(${unit}::text, ((a."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')), 'YYYY-MM-DD') AS bucket,
        CASE
          WHEN ${breakdown}::text = 'status' THEN COALESCE(l.status, '')
          WHEN ${breakdown}::text = 'origin' THEN CASE WHEN a."user" = ANY(${adminIds}::text[]) THEN 'admin' ELSE 'user' END
          ELSE 'total'
        END AS segment,
        COUNT(*)::int AS n
      FROM "Animal" a
      LEFT JOIN latest l ON l."animal" = a."id"
      WHERE a."duplicateOf" IS NULL AND a."createdAt" >= ${startUtc}::timestamp
      GROUP BY 1, 2
    `);
  }

  if (metric === "pet_users") {
    return unwrapPrisma(await prisma.$queryRaw`
      SELECT
        to_char(date_trunc(${unit}::text, ((u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')), 'YYYY-MM-DD') AS bucket,
        'total' AS segment,
        COUNT(*)::int AS n
      FROM "User" u
      WHERE u."product" = ${PRODUCT.PET} AND u."company" IS NULL AND NOT u."userTest"
        AND u."createdAt" >= ${startUtc}::timestamp
      GROUP BY 1, 2
    `);
  }

  if (metric === "places_claimed") {
    return unwrapPrisma(await prisma.$queryRaw`
      SELECT
        to_char(date_trunc(${unit}::text, ((p."claimedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')), 'YYYY-MM-DD') AS bucket,
        'total' AS segment,
        COUNT(*)::int AS n
      FROM "PetPlace" p
      WHERE p."claimedAt" >= ${startUtc}::timestamp
        AND (${placeType}::text IS NULL OR EXISTS (
          SELECT 1 FROM "_PetPlace_types" pt JOIN "PetPlaceType" t ON t."id" = pt."B"
          WHERE pt."A" = p."id" AND t."value" = ${placeType}::text
        ))
      GROUP BY 1, 2
    `);
  }

  if (metric === "places_verified") {
    return unwrapPrisma(await prisma.$queryRaw`
      SELECT
        to_char(date_trunc(${unit}::text, ((p."verifiedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')), 'YYYY-MM-DD') AS bucket,
        'total' AS segment,
        COUNT(*)::int AS n
      FROM "PetPlace" p
      WHERE p."verifiedAt" >= ${startUtc}::timestamp
        AND (${placeType}::text IS NULL OR EXISTS (
          SELECT 1 FROM "_PetPlace_types" pt JOIN "PetPlaceType" t ON t."id" = pt."B"
          WHERE pt."A" = p."id" AND t."value" = ${placeType}::text
        ))
      GROUP BY 1, 2
    `);
  }

  return unwrapPrisma(await prisma.$queryRaw`
    SELECT
      to_char(date_trunc(${unit}::text, ((p."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')), 'YYYY-MM-DD') AS bucket,
      'total' AS segment,
      COUNT(*)::int AS n
    FROM "PetPlace" p
    WHERE p."createdAt" >= ${startUtc}::timestamp
      AND (${placeType}::text IS NULL OR EXISTS (
        SELECT 1 FROM "_PetPlace_types" pt JOIN "PetPlaceType" t ON t."id" = pt."B"
        WHERE pt."A" = p."id" AND t."value" = ${placeType}::text
      ))
    GROUP BY 1, 2
  `);
}

// ---------------------------------------------------------------------------------------------

type CountRow = { key: string; count: number };

function sortedCounts(map: Map<string, number>): CountRow[] {
  return Array.from(map, ([key, count]) => ({ key, count }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Estatus actual (último registro de la bitácora) de los animales que no son duplicados. */
async function animalsByStatus(prisma: any): Promise<CountRow[]> {
  const rows: Array<{ status: string | null; n: number }> = unwrapPrisma(await prisma.$queryRaw`
    WITH latest AS (
      SELECT DISTINCT ON ("animal") "animal", status
      FROM "AnimalLog"
      WHERE "animal" IS NOT NULL
      ORDER BY "animal", "date_status" DESC NULLS LAST, "createdAt" DESC NULLS LAST
    )
    SELECT l.status, COUNT(*)::int AS n
    FROM "Animal" a
    LEFT JOIN latest l ON l."animal" = a."id"
    WHERE a."duplicateOf" IS NULL
    GROUP BY l.status
  `);
  const counts = new Map<string, number>(STATUS_KEYS.map((key) => [key, 0]));
  for (const row of rows) {
    const key = normalizeStatus(row.status);
    counts.set(key, (counts.get(key) ?? 0) + row.n);
  }
  // Orden fijo de la bitácora (no por tamaño): el front pinta cada estatus con su color.
  return STATUS_KEYS.map((key) => ({ key, count: counts.get(key) ?? 0 }));
}

/**
 * Estados o ciudades más frecuentes según la ubicación del último registro de la bitácora.
 * Se agrupa sin mayúsculas ni espacios y se muestra la forma más común en que se escribió.
 */
async function animalsTopPlaces(prisma: any, column: "state" | "city"): Promise<CountRow[]> {
  const rows: Array<{ key: string; n: number }> =
    column === "state"
      ? unwrapPrisma(await prisma.$queryRaw`
          WITH latest AS (
            SELECT DISTINCT ON ("animal") "animal", state
            FROM "AnimalLog"
            WHERE "animal" IS NOT NULL
            ORDER BY "animal", "date_status" DESC NULLS LAST, "createdAt" DESC NULLS LAST
          )
          SELECT mode() WITHIN GROUP (ORDER BY trim(l.state)) AS key, COUNT(*)::int AS n
          FROM latest l
          JOIN "Animal" a ON a."id" = l."animal"
          WHERE a."duplicateOf" IS NULL AND trim(l.state) <> ''
          GROUP BY lower(trim(l.state))
          ORDER BY n DESC
          LIMIT ${TOP_PLACES}
        `)
      : unwrapPrisma(await prisma.$queryRaw`
          WITH latest AS (
            SELECT DISTINCT ON ("animal") "animal", city
            FROM "AnimalLog"
            WHERE "animal" IS NOT NULL
            ORDER BY "animal", "date_status" DESC NULLS LAST, "createdAt" DESC NULLS LAST
          )
          SELECT mode() WITHIN GROUP (ORDER BY trim(l.city)) AS key, COUNT(*)::int AS n
          FROM latest l
          JOIN "Animal" a ON a."id" = l."animal"
          WHERE a."duplicateOf" IS NULL AND trim(l.city) <> ''
          GROUP BY lower(trim(l.city))
          ORDER BY n DESC
          LIMIT ${TOP_PLACES}
        `);
  return rows.map((row) => ({ key: row.key, count: row.n }));
}

async function placesTopStates(prisma: any): Promise<CountRow[]> {
  const rows: Array<{ key: string; n: number }> = unwrapPrisma(await prisma.$queryRaw`
    SELECT mode() WITHIN GROUP (ORDER BY trim(state)) AS key, COUNT(*)::int AS n
    FROM "PetPlace"
    WHERE trim(state) <> ''
    GROUP BY lower(trim(state))
    ORDER BY n DESC
    LIMIT ${TOP_PLACES}
  `);
  return rows.map((row) => ({ key: row.key, count: row.n }));
}

async function animalsByType(prisma: any): Promise<CountRow[]> {
  const [groups, types] = await Promise.all([
    prisma.animal.groupBy({ by: ["animal_typeId"], where: { duplicateOfId: null }, _count: { _all: true } }),
    prisma.animalType.findMany({ select: { id: true, name: true } }),
  ]);
  const typeName = new Map<string, string>(types.map((type: { id: string; name: string }) => [type.id, type.name]));
  const counts = new Map<string, number>();
  for (const group of groups as Array<{ animal_typeId: string | null; _count: { _all: number } }>) {
    const key = (group.animal_typeId && typeName.get(group.animal_typeId)) || "none";
    counts.set(key, (counts.get(key) ?? 0) + group._count._all);
  }
  return sortedCounts(counts);
}

async function groupCounts(
  prisma: any,
  model: "animal" | "petPlace",
  field: string,
  where: Record<string, unknown>,
): Promise<CountRow[]> {
  const groups: Array<Record<string, unknown> & { _count: { _all: number } }> = await prisma[model].groupBy({
    by: [field],
    where,
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const group of groups) {
    const key = (group[field] as string | null) || "none";
    counts.set(key, (counts.get(key) ?? 0) + group._count._all);
  }
  return sortedCounts(counts);
}

async function placesByType(prisma: any): Promise<CountRow[]> {
  const types: Array<{ value: string; _count: { from_PetPlace_types: number } }> = await prisma.petPlaceType.findMany({
    select: { value: true, _count: { select: { from_PetPlace_types: true } } },
  });
  return types
    .map((type) => ({ key: type.value, count: type._count.from_PetPlace_types }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Animales más vistos en la ventana, con su portada y estatus actual. */
async function topViewedAnimals(context: KeystoneContext, prisma: any, since: Date | null) {
  const groups: Array<{ animalId: string | null; _count: { animalId: number } }> = await prisma.animalView.groupBy({
    by: ["animalId"],
    where: {
      animalId: { not: null },
      animal: { is: { duplicateOfId: null } },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    _count: { animalId: true },
    orderBy: { _count: { animalId: "desc" } },
    take: TOP_VIEWED,
  });
  const ids = groups.map((group) => group.animalId).filter((id): id is string => Boolean(id));
  if (!ids.length) return [];

  const animals = (await context.sudo().query.Animal.findMany({
    where: { id: { in: ids } },
    query: `
      id name slug
      multimedia(orderBy: [{ order: asc }], take: 1) { image { url } }
      logs(orderBy: [{ date_status: desc }, { createdAt: desc }], take: 1) { status }
    `,
  })) as Array<{
    id: string;
    name: string;
    slug: string | null;
    multimedia: Array<{ image: { url: string } | null }> | null;
    logs: Array<{ status: string | null }> | null;
  }>;
  const byId = new Map(animals.map((animal) => [animal.id, animal]));

  return groups.flatMap((group) => {
    const animal = group.animalId ? byId.get(group.animalId) : null;
    if (!animal) return [];
    return [
      {
        id: animal.id,
        name: animal.name,
        slug: animal.slug,
        status: normalizeStatus(animal.logs?.[0]?.status),
        coverUrl: animal.multimedia?.[0]?.image?.url ?? null,
        views: group._count.animalId,
      },
    ];
  });
}

// ---------------------------------------------------------------------------------------------

const resolver = {
  adminPetSummary: async (
    _root: unknown,
    { input }: { input?: { days?: number | null } | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const days = input?.days == null ? null : clampInt(input.days, 7, 3650, 90);
    const since = days ? daysAgo(days) : null;
    const prevSince = days ? daysAgo(days * 2) : null;

    const inPeriod = since ? { createdAt: { gte: since } } : {};
    const inPrevPeriod = since && prevSince ? { createdAt: { gte: prevSince, lt: since } } : null;
    const animalBase = { duplicateOfId: null };
    const adminRole = { roles: { some: { name: Role.ADMIN } } };

    const [
      animalsTotal,
      animalsNew,
      animalsPrev,
      facebookPublished,
      duplicatesMerged,
      animalsFromAdmin,
      byStatus,
      byType,
      byReportedBy,
      topStates,
      topCities,
    ] = await Promise.all([
      prisma.animal.count({ where: animalBase }),
      prisma.animal.count({ where: { ...animalBase, ...inPeriod } }),
      inPrevPeriod ? prisma.animal.count({ where: { ...animalBase, ...inPrevPeriod } }) : 0,
      prisma.animal.count({ where: { ...animalBase, facebookPublishedAt: { not: null } } }),
      prisma.animal.count({ where: { duplicateOfId: { not: null } } }),
      prisma.animal.count({ where: { ...animalBase, user: { is: adminRole } } }),
      animalsByStatus(prisma),
      animalsByType(prisma),
      groupCounts(prisma, "animal", "reportedBy", animalBase),
      animalsTopPlaces(prisma, "state"),
      animalsTopPlaces(prisma, "city"),
    ]);

    const [
      placesTotal,
      veterinaries,
      verified,
      fromGoogle,
      reviews,
      likes,
      placesNew,
      placesPrev,
      byClaimStatus,
      placeTypes,
      placeStates,
    ] = await Promise.all([
      prisma.petPlace.count(),
      prisma.petPlace.count({ where: { types: { some: { value: "veterinary" } } } }),
      prisma.petPlace.count({ where: { verified: true } }),
      prisma.petPlace.count({ where: { google_place_id: { not: null } } }),
      prisma.review.count({ where: { pet_placeId: { not: null } } }),
      prisma.petPlaceLike.count({ where: { pet_placeId: { not: null } } }),
      prisma.petPlace.count({ where: inPeriod }),
      inPrevPeriod ? prisma.petPlace.count({ where: inPrevPeriod }) : 0,
      groupCounts(prisma, "petPlace", "claimStatus", {}),
      placesByType(prisma),
      placesTopStates(prisma),
    ]);

    const [usersTotal, usersNew, usersPrev, views, viewsSignedIn, favorites, comments, topViewed, animalClaims, placeClaims, services] =
      await Promise.all([
        prisma.user.count({ where: PET_USER_WHERE }),
        prisma.user.count({ where: { ...PET_USER_WHERE, ...inPeriod } }),
        inPrevPeriod ? prisma.user.count({ where: { ...PET_USER_WHERE, ...inPrevPeriod } }) : 0,
        prisma.animalView.count({ where: inPeriod }),
        prisma.animalView.count({ where: { ...inPeriod, userId: { not: null } } }),
        prisma.animalFavorite.count({ where: inPeriod }),
        prisma.animalComment.count({ where: { ...inPeriod, kind: "comment" } }),
        topViewedAnimals(context, prisma, since),
        prisma.animalClaim.count({ where: { status: "pending" } }),
        prisma.petPlace.count({ where: { claimStatus: "pending" } }),
        prisma.petPlaceService.count({ where: { status: "pending" } }),
      ]);

    const facebookPending = Math.max(0, animalsTotal - facebookPublished);
    return {
      days,
      animals: {
        total: animalsTotal,
        newInPeriod: animalsNew,
        newPrevPeriod: animalsPrev,
        facebookPublished,
        facebookPending,
        duplicatesMerged,
        byStatus,
        byType,
        byOrigin: [
          { key: "user", count: Math.max(0, animalsTotal - animalsFromAdmin) },
          { key: "admin", count: animalsFromAdmin },
        ],
        byReportedBy,
        topStates,
        topCities,
      },
      places: {
        total: placesTotal,
        veterinaries,
        verified,
        fromGoogle,
        reviews,
        likes,
        newInPeriod: placesNew,
        newPrevPeriod: placesPrev,
        byClaimStatus,
        byType: placeTypes,
        topStates: placeStates,
      },
      users: { total: usersTotal, newInPeriod: usersNew, newPrevPeriod: usersPrev },
      engagement: { views, viewsSignedIn, favorites, comments, topViewed },
      pending: { animalClaims, placeClaims, services, facebookPending },
      generatedAt: new Date().toISOString(),
    };
  },

  adminPetSeries: async (
    _root: unknown,
    {
      input,
    }: {
      input: {
        metric: string;
        granularity?: string | null;
        range?: string | null;
        breakdown?: string | null;
        placeType?: string | null;
      };
    },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const metric = oneOf(input.metric, METRICS, "animals", "métrica");
    const granularity = oneOf(input.granularity, GRANULARITIES, "week", "agrupación");
    const range = input.range?.trim() || "90d";
    if (!(range in RANGE_DAYS)) throw new Error(`Rango no válido: ${range}.`);
    // El desglose solo existe para animales.
    const breakdown = metric === "animals" ? oneOf(input.breakdown, BREAKDOWNS, "none", "desglose") : "none";
    let placeType: string | null = null;
    if (metric.startsWith("places_") && input.placeType?.trim()) {
      placeType = input.placeType.trim();
      const exists = await prisma.petPlaceType.count({ where: { value: placeType } });
      if (!exists) throw new Error(`Tipo de lugar no válido: ${placeType}.`);
    }

    const today = toMxDay(new Date());
    const rangeDays = RANGE_DAYS[range];
    let startDay = rangeDays ? addDays(today, -(rangeDays - 1)) : (await firstDayOf(prisma, metric, placeType)) ?? today;
    if (granularity === "day") {
      const earliest = addDays(today, -(MAX_DAY_BUCKETS - 1));
      if (startDay < earliest) startDay = earliest;
    }

    // Periodos completos desde el primero que toca el rango hasta el de hoy (que va a medias).
    const lastBucket = bucketStart(today, granularity);
    let buckets: string[] = [];
    for (let bucket = bucketStart(startDay, granularity); bucket <= lastBucket; bucket = nextBucket(bucket, granularity)) {
      buckets.push(bucket);
    }
    if (buckets.length > MAX_BUCKETS) buckets = buckets.slice(-MAX_BUCKETS);
    const from = buckets[0];

    const rows = await seriesRows(prisma, {
      metric,
      granularity,
      breakdown,
      placeType,
      startUtc: mxDayStartUtc(from),
    });

    const byBucket = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const segment = breakdown === "status" ? normalizeStatus(row.segment) : row.segment;
      const segments = byBucket.get(row.bucket) ?? new Map<string, number>();
      segments.set(segment, (segments.get(segment) ?? 0) + row.n);
      byBucket.set(row.bucket, segments);
    }

    let total = 0;
    const points = buckets.map((bucket) => {
      const segments = byBucket.get(bucket) ?? new Map<string, number>();
      const pointTotal = Array.from(segments.values()).reduce((sum, n) => sum + n, 0);
      total += pointTotal;
      return {
        bucket,
        total: pointTotal,
        segments: breakdown === "none" ? [] : sortedCounts(segments),
      };
    });

    return { metric, granularity, breakdown, from, to: lastBucket, total, points };
  },
};

export default { typeDefs, definition, resolver };
