import type { KeystoneContext } from "@keystone-6/core/types";
import { RESCUE_ORG_STATUS } from "../../../models/Pet/RescueOrganization/constants";
import { EMPTY_IMPACT, rescueImpactByOrg } from "../../../models/Pet/RescueOrganization/impact";

/**
 * Aliados KADESH (portada y /aliados): espacios de rescate verificados que un admin marcó como
 * aliados. Orden: primero el manual (`allyOrder`), luego por impacto (adopciones y animales
 * publicados), y al final los más antiguos como aliados. Público y sin datos de contacto.
 */
const MAX_TAKE = 300;

const typeDefs = `
  type RescueAlly {
    id: ID!
    name: String!
    slug: String
    type: String!
    city: String
    state: String
    logoUrl: String
    allySince: String
    publishedCount: Int!
    adoptedCount: Int!
  }

  type RescueAlliesResult {
    total: Int!
    allies: [RescueAlly!]!
  }
`;

const definition = `rescueAllies(take: Int): RescueAlliesResult!`;

type Row = {
  id: string;
  name: string;
  slug: string | null;
  type: string;
  city?: string | null;
  state?: string | null;
  allySince?: string | null;
  allyOrder?: number | null;
  logo?: { url?: string | null } | null;
};

const resolver = {
  rescueAllies: async (_root: unknown, { take }: { take?: number | null }, context: KeystoneContext) => {
    const limit = Math.min(Math.max(Number(take) || MAX_TAKE, 1), MAX_TAKE);
    const rows = (await context.sudo().query.RescueOrganization.findMany({
      where: { isAlly: { equals: true }, status: { equals: RESCUE_ORG_STATUS.VERIFIED } },
      query: "id name slug type city state allySince allyOrder logo { url }",
      take: MAX_TAKE,
    })) as Row[];

    const impact = await rescueImpactByOrg(
      context,
      rows.map((row) => row.id),
    );
    const allies = rows
      .map((row) => {
        const stats = impact.get(row.id) ?? EMPTY_IMPACT;
        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          type: row.type,
          city: row.city || null,
          state: row.state || null,
          logoUrl: row.logo?.url ?? null,
          allySince: row.allySince ? new Date(row.allySince).toISOString() : null,
          allyOrder: row.allyOrder ?? null,
          publishedCount: stats.animals,
          adoptedCount: stats.adopted,
        };
      })
      .sort((a, b) => {
        const orderA = a.allyOrder ?? Number.POSITIVE_INFINITY;
        const orderB = b.allyOrder ?? Number.POSITIVE_INFINITY;
        if (orderA !== orderB) return orderA - orderB;
        if (a.adoptedCount !== b.adoptedCount) return b.adoptedCount - a.adoptedCount;
        if (a.publishedCount !== b.publishedCount) return b.publishedCount - a.publishedCount;
        return (a.allySince ?? "").localeCompare(b.allySince ?? "");
      });

    return { total: allies.length, allies: allies.slice(0, limit) };
  },
};

export default { typeDefs, definition, resolver };
