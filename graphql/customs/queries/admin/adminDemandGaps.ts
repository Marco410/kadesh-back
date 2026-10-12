import type { KeystoneContext } from "@keystone-6/core/types";
import { adminPrisma, analyticsExcludedCompanyIds, assertPlatformAdmin, clampInt, daysAgo, toIso } from "./shared";

/**
 * Demanda no cubierta: extracciones exitosas que trajeron pocos resultados, por giro y por zona.
 * Sirve para saber dónde falta cobertura (Google Maps / INEGI) o qué giros buscan los clientes
 * sin encontrar.
 *
 * Resultados = leads nuevos + los que ya estaban en la base. Los descartados por calificación
 * no cuentan: los quitó el filtro del cliente, no la falta de negocios. Las corridas con error
 * tampoco: son fallas, no demanda. Zona = cuadro de 0.1° (unos 11 km).
 */

const ZONE_STEP = 0.1;
const LIST_LIMIT = 25;

const typeDefs = `
  input AdminDemandGapsInput {
    """Últimos N días (7–365, por defecto 90)."""
    days: Int
    """Con estos resultados o menos la corrida cuenta como "pocos" (0–20, por defecto 5)."""
    threshold: Int
  }

  type AdminDemandCategory {
    category: String!
    runs: Int!
    lowRuns: Int!
    avgResults: Float!
    companies: Int!
  }

  type AdminDemandZone {
    """Centro aproximado del cuadro de unos 11 km."""
    lat: Float!
    lng: Float!
    runs: Int!
    lowRuns: Int!
    avgResults: Float!
    companies: Int!
    """Giros con pocos resultados en la zona (los que más se repiten)."""
    topCategories: [String!]!
  }

  type AdminDemandGap {
    category: String!
    lat: Float!
    lng: Float!
    runs: Int!
    lowRuns: Int!
    avgResults: Float!
    companies: Int!
    lastAt: String
  }

  type AdminDemandGaps {
    days: Int!
    threshold: Int!
    runs: Int!
    lowRuns: Int!
    """Giros con más corridas de pocos resultados."""
    categories: [AdminDemandCategory!]!
    zones: [AdminDemandZone!]!
    """Giro + zona que se buscaron varias veces sin encontrar."""
    gaps: [AdminDemandGap!]!
  }

  type Query {
    adminDemandGaps(input: AdminDemandGapsInput): AdminDemandGaps!
  }
`;

const definition = `
  adminDemandGaps(input: AdminDemandGapsInput): AdminDemandGaps!
`;

type Bucket = {
  runs: number;
  lowRuns: number;
  results: number;
  companies: Set<string>;
  lastAt: Date | null;
  lowCategories?: Map<string, number>;
};

function emptyBucket(): Bucket {
  return { runs: 0, lowRuns: 0, results: 0, companies: new Set(), lastAt: null };
}

function addRun(bucket: Bucket, results: number, low: boolean, companyId: string | null, at: Date | null) {
  bucket.runs += 1;
  bucket.results += results;
  if (low) bucket.lowRuns += 1;
  if (companyId) bucket.companies.add(companyId);
  if (at && (!bucket.lastAt || at > bucket.lastAt)) bucket.lastAt = at;
}

const roundZone = (value: number) => Math.round(value / ZONE_STEP) * ZONE_STEP;
const zoneKey = (lat: number, lng: number) => `${roundZone(lat).toFixed(1)},${roundZone(lng).toFixed(1)}`;
const avg = (bucket: Bucket) => (bucket.runs ? Math.round((bucket.results / bucket.runs) * 10) / 10 : 0);
const byLowRuns = (a: Bucket, b: Bucket) => b.lowRuns - a.lowRuns || b.runs - a.runs;

const resolver = {
  adminDemandGaps: async (
    _root: unknown,
    { input }: { input?: { days?: number | null; threshold?: number | null } | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const days = clampInt(input?.days, 7, 365, 90);
    const threshold = clampInt(input?.threshold, 0, 20, 5);
    const excludedIds = [...(await analyticsExcludedCompanyIds(prisma))];

    const runs: Array<{
      companyId: string | null;
      category: string;
      lat: number | null;
      lng: number | null;
      created: number | null;
      alreadyInDb: number | null;
      createdAt: Date | null;
    }> = await prisma.techLeadSyncLog.findMany({
      where: {
        success: true,
        createdAt: { gte: daysAgo(days) },
        OR: [{ companyId: null }, { companyId: { notIn: excludedIds } }],
      },
      select: {
        companyId: true,
        category: true,
        lat: true,
        lng: true,
        created: true,
        alreadyInDb: true,
        createdAt: true,
      },
    });

    const categories = new Map<string, Bucket>();
    const zones = new Map<string, Bucket>();
    const gaps = new Map<string, Bucket & { category: string; zone: string }>();
    let lowRuns = 0;

    for (const run of runs) {
      const results = (run.created ?? 0) + (run.alreadyInDb ?? 0);
      const low = results <= threshold;
      if (low) lowRuns += 1;
      const category = run.category?.trim() || "Sin giro";
      const at = run.createdAt ? new Date(run.createdAt) : null;

      const categoryBucket = categories.get(category) ?? emptyBucket();
      addRun(categoryBucket, results, low, run.companyId, at);
      categories.set(category, categoryBucket);

      if (run.lat == null || run.lng == null) continue;
      const zone = zoneKey(run.lat, run.lng);
      const zoneBucket = zones.get(zone) ?? { ...emptyBucket(), lowCategories: new Map<string, number>() };
      addRun(zoneBucket, results, low, run.companyId, at);
      if (low) zoneBucket.lowCategories?.set(category, (zoneBucket.lowCategories.get(category) ?? 0) + 1);
      zones.set(zone, zoneBucket);

      const gapKey = `${category}|${zone}`;
      const gapBucket = gaps.get(gapKey) ?? { ...emptyBucket(), category, zone };
      addRun(gapBucket, results, low, run.companyId, at);
      gaps.set(gapKey, gapBucket);
    }

    const coords = (zone: string) => {
      const [lat, lng] = zone.split(",").map(Number);
      return { lat, lng };
    };

    return {
      days,
      threshold,
      runs: runs.length,
      lowRuns,
      categories: [...categories.entries()]
        .filter(([, bucket]) => bucket.lowRuns > 0)
        .sort(([, a], [, b]) => byLowRuns(a, b))
        .slice(0, LIST_LIMIT)
        .map(([category, bucket]) => ({
          category,
          runs: bucket.runs,
          lowRuns: bucket.lowRuns,
          avgResults: avg(bucket),
          companies: bucket.companies.size,
        })),
      zones: [...zones.entries()]
        .filter(([, bucket]) => bucket.lowRuns > 0)
        .sort(([, a], [, b]) => byLowRuns(a, b))
        .slice(0, LIST_LIMIT)
        .map(([zone, bucket]) => ({
          ...coords(zone),
          runs: bucket.runs,
          lowRuns: bucket.lowRuns,
          avgResults: avg(bucket),
          companies: bucket.companies.size,
          topCategories: [...(bucket.lowCategories?.entries() ?? [])]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([category]) => category),
        })),
      // Una sola corrida floja puede ser un error de dedo: se piden al menos 2.
      gaps: [...gaps.values()]
        .filter((bucket) => bucket.lowRuns >= 2)
        .sort(byLowRuns)
        .slice(0, LIST_LIMIT)
        .map((bucket) => ({
          category: bucket.category,
          ...coords(bucket.zone),
          runs: bucket.runs,
          lowRuns: bucket.lowRuns,
          avgResults: avg(bucket),
          companies: bucket.companies.size,
          lastAt: toIso(bucket.lastAt),
        })),
    };
  },
};

export default { typeDefs, definition, resolver };
