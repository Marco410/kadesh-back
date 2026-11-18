import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId } from "../../../../utils/access/tenant";
import { pawsEnabled, setPawRankingHidden } from "../../../../utils/pet/paws";
import { invalidatePawLeaderboard } from "../../queries/pawLeaderboard";

/**
 * Paw points: what a person can change about their own account. Today, only whether they appear
 * in the public ranking (`pawLeaderboard`). Earning is never a mutation: it happens inside the
 * actions themselves (`utils/pet/pawsTriggers.ts`).
 */
const typeDefs = `
  type PawRankingVisibilityResult {
    success: Boolean!
    message: String!
    rankingHidden: Boolean
  }
`;

const definition = `
  setPawRankingVisibility(hidden: Boolean!): PawRankingVisibilityResult!
`;

const resolver = {
  setPawRankingVisibility: async (_root: unknown, { hidden }: { hidden: boolean }, context: KeystoneContext) => {
    const userId = getSessionUserId(context.session as any);
    if (!userId) return { success: false, message: "Inicia sesión para cambiar esto.", rankingHidden: null };
    if (!pawsEnabled()) {
      return { success: false, message: "Las huellitas todavía no están disponibles.", rankingHidden: null };
    }
    try {
      const rankingHidden = await setPawRankingHidden(context, userId, Boolean(hidden));
      invalidatePawLeaderboard();
      return {
        success: true,
        message: rankingHidden ? "Ya no apareces en el ranking." : "Ya apareces en el ranking.",
        rankingHidden,
      };
    } catch (error) {
      console.error("[setPawRankingVisibility]", error);
      return { success: false, message: "No pudimos guardar el cambio. Intenta de nuevo.", rankingHidden: null };
    }
  },
};

export default { typeDefs, definition, resolver };
