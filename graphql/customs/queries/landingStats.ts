import { KeystoneContext } from "@keystone-6/core/types";
import { analyticsExcludedCompanyIds } from "./admin/shared";

/**
 * Cifras públicas de la landing (kadesh.com.mx): solo conteos agregados, nada que identifique a
 * un negocio, una persona o una empresa. Pública (sin sesión). Se cachea en memoria 6 h porque
 * los conteos recorren `TechBusinessLead` completo y la landing la ve cualquiera.
 */
const CACHE_MS = 6 * 60 * 60 * 1000;

type LandingStats = {
  leadsTotal: number;
  leadsWithPhone: number;
  categories: number;
  cities: number;
  companies: number;
  updatedAt: string;
};

let cache: { value: LandingStats; at: number } | null = null;

const typeDefs = `
  type LandingStats {
    leadsTotal: Int!
    leadsWithPhone: Int!
    categories: Int!
    cities: Int!
    companies: Int!
    updatedAt: String!
  }
`;

const definition = `landingStats: LandingStats!`;

/** Prisma de Keystone devuelve el error en vez de lanzarlo: aquí se convierte en excepción. */
function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return value;
}

async function computeLandingStats(context: KeystoneContext): Promise<LandingStats> {
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  const nonEmpty = { not: "" };

  const [leadsTotal, leadsWithPhone, categoryGroups, cityGroups, companiesTotal, excluded] =
    await Promise.all([
      prisma.techBusinessLead.count(),
      prisma.techBusinessLead.count({ where: { phone: nonEmpty } }),
      prisma.techBusinessLead.groupBy({ by: ["category"], where: { category: nonEmpty } }),
      prisma.techBusinessLead.groupBy({ by: ["city"], where: { city: nonEmpty } }),
      prisma.saasCompany.count(),
      analyticsExcludedCompanyIds(prisma),
    ]);

  return {
    leadsTotal: unwrap<number>(leadsTotal),
    leadsWithPhone: unwrap<number>(leadsWithPhone),
    categories: unwrap<unknown[]>(categoryGroups).length,
    cities: unwrap<unknown[]>(cityGroups).length,
    // Sin cuentas de prueba ni empresas del equipo de Kadesh (misma regla que la Analítica).
    companies: Math.max(0, unwrap<number>(companiesTotal) - excluded.size),
    updatedAt: new Date().toISOString(),
  };
}

const resolver = {
  landingStats: async (
    _root: unknown,
    _args: unknown,
    context: KeystoneContext,
  ): Promise<LandingStats> => {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
    const value = await computeLandingStats(context);
    cache = { value, at: Date.now() };
    return value;
  },
};

export default { typeDefs, definition, resolver };
