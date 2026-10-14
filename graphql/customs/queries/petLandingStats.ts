import { KeystoneContext } from "@keystone-6/core/types";

/**
 * Cifras públicas del hero de KADESH Pet (pet.kadesh.com.mx). Solo conteos agregados:
 * nada que identifique a un animal, a quien lo reportó, su teléfono o su ubicación.
 * Pública (sin sesión) y cacheada en memoria 1 h porque la ve cualquier visitante.
 */
const CACHE_MS = 60 * 60 * 1000;

/** Estados finales de un animal que ya tiene hogar (ver ANIMAL_LOGS_OPTIONS). */
const HOME_STATUSES = ["in_family", "adopted"];

type PetLandingStats = {
  animals: number;
  animalsLost: number;
  animalsHome: number;
  animalsInAdoption: number;
  veterinaries: number;
  veterinariesVerified: number;
  cities: number;
  updatedAt: string;
};

let cache: { value: PetLandingStats; at: number } | null = null;

const typeDefs = `
  type PetLandingStats {
    animals: Int!
    animalsLost: Int!
    animalsHome: Int!
    animalsInAdoption: Int!
    veterinaries: Int!
    veterinariesVerified: Int!
    cities: Int!
    updatedAt: String!
  }
`;

const definition = `petLandingStats: PetLandingStats!`;

/** Prisma de Keystone devuelve el error en vez de lanzarlo: aquí se convierte en excepción. */
function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return value;
}

async function computePetLandingStats(context: KeystoneContext): Promise<PetLandingStats> {
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  const veterinary = { types: { some: { value: "veterinary" } } };

  const [animals, statusRows, veterinaries, veterinariesVerified, cityRows] = await Promise.all([
    prisma.animal.count(),
    // Estado actual de cada animal = su registro más reciente en la bitácora.
    prisma.$queryRaw`
      SELECT status, COUNT(*)::int AS n
      FROM (
        SELECT DISTINCT ON ("animal") "animal", status
        FROM "AnimalLog"
        WHERE "animal" IS NOT NULL
        ORDER BY "animal", "date_status" DESC NULLS LAST, "createdAt" DESC NULLS LAST
      ) latest
      GROUP BY status
    `,
    prisma.petPlace.count({ where: veterinary }),
    prisma.petPlace.count({ where: { ...veterinary, verified: true } }),
    // Ciudades con al menos un reporte o una veterinaria.
    prisma.$queryRaw`
      SELECT COUNT(DISTINCT lower(trim(c)))::int AS n
      FROM (
        SELECT city AS c FROM "AnimalLog"
        UNION ALL
        SELECT municipality AS c FROM "PetPlace"
      ) places
      WHERE trim(c) <> ''
    `,
  ]);

  const byStatus = new Map<string, number>(
    unwrap<{ status: string | null; n: number }[]>(statusRows).map((row) => [
      row.status ?? "",
      row.n,
    ]),
  );
  const count = (statuses: string[]) =>
    statuses.reduce((total, status) => total + (byStatus.get(status) ?? 0), 0);

  return {
    animals: unwrap<number>(animals),
    animalsLost: count(["lost"]),
    animalsHome: count(HOME_STATUSES),
    animalsInAdoption: count(["in_adoption"]),
    veterinaries: unwrap<number>(veterinaries),
    veterinariesVerified: unwrap<number>(veterinariesVerified),
    cities: unwrap<{ n: number }[]>(cityRows)[0]?.n ?? 0,
    updatedAt: new Date().toISOString(),
  };
}

const resolver = {
  petLandingStats: async (
    _root: unknown,
    _args: unknown,
    context: KeystoneContext,
  ): Promise<PetLandingStats> => {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
    const value = await computePetLandingStats(context);
    cache = { value, at: Date.now() };
    return value;
  },
};

export default { typeDefs, definition, resolver };
