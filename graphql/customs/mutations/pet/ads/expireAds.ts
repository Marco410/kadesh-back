import type { KeystoneContext } from "@keystone-6/core/types";
import { AD_STATUS } from "../../../../../models/Pet/Ad/constants";
import { invalidateActiveAds } from "../../../../../utils/pet/ads";
import { mxToday } from "../../../../../utils/usage/dailyUsageRollup";

const typeDefs = `
  type ExpireAdsResult {
    success: Boolean!
    message: String!
    ended: Int!
  }
`;

const definition = `
  expireAds(secret: String!): ExpireAdsResult!
`;

const resolver = {
  /**
   * Cron (GitHub Actions, every hour with `expireStoreOrders`): marks as ended the active and
   * paused ads whose end date passed. The public list already filters by date; this only keeps the
   * status honest in Operaciones. One UPDATE.
   */
  expireAds: async (_root: unknown, { secret }: { secret: string }, context: KeystoneContext) => {
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected || secret !== expected) return { success: false, message: "No autorizado.", ended: 0 };

    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    const result = await prisma.ad.updateMany({
      where: {
        status: { in: [AD_STATUS.ACTIVE, AD_STATUS.PAUSED] },
        endDate: { lt: new Date(`${mxToday()}T00:00:00.000Z`) },
      },
      data: { status: AD_STATUS.ENDED },
    });
    if (result instanceof Error) {
      console.error("[expireAds]", result);
      return { success: false, message: "No se pudieron revisar los anuncios.", ended: 0 };
    }
    if (result.count > 0) invalidateActiveAds();
    return { success: true, message: `Terminados: ${result.count}.`, ended: result.count };
  },
};

export default { typeDefs, definition, resolver };
