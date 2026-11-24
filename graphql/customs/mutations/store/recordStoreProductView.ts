import type { KeystoneContext } from "@keystone-6/core/types";
import {
  STORE_PRODUCT_STATUS,
  STORE_PRODUCT_VIEW_DEDUPE_MS,
  STORE_PRODUCT_VIEWS_PUBLIC_MIN,
} from "../../../../models/Pet/Store/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { requestIp, requestUserAgent } from "../../../../utils/activity/requestMeta";
import { isKnownCrawlerRequest } from "../../../../utils/security/knownCrawlers";
import { createDeduper } from "../../../../utils/security/rateLimit";
import { storePrisma } from "../../../../utils/store/catalog";
import { storeEnabled } from "../../../../utils/store/config";

const typeDefs = `
  type StoreProductViewResult {
    "Whether this visit counted. Admins, bots and repeats within 30 min do not."
    counted: Boolean!
    "Total views to show, or null while the product has fewer than the public minimum."
    viewsCount: Int
  }
`;

const definition = `
  recordStoreProductView(productId: ID!): StoreProductViewResult!
`;

/** In process memory: after a restart someone may add one extra view. Good enough. */
const firstVisit = createDeduper(STORE_PRODUCT_VIEW_DEDUPE_MS);

/** With a session, the person; without one, IP + browser (IP alone would merge a shared network). */
function visitorKey(context: KeystoneContext): string {
  const userId = getSessionUserId(context.session);
  if (userId) return `u:${userId}`;
  return `ip:${requestIp(context.req) ?? "?"}|${requestUserAgent(context.req) ?? ""}`;
}

/** Admins always see the number; the public only from `STORE_PRODUCT_VIEWS_PUBLIC_MIN`. */
function shown(viewsCount: number, isAdmin: boolean): number | null {
  return isAdmin || viewsCount >= STORE_PRODUCT_VIEWS_PUBLIC_MIN ? viewsCount : null;
}

const resolver = {
  /**
   * The product page calls it once when it opens and shows the total it returns. Never fails
   * outward: on any error it answers `counted: false` and the page shows no number.
   */
  recordStoreProductView: async (
    _root: unknown,
    { productId }: { productId: string },
    context: KeystoneContext,
  ) => {
    const none = { counted: false, viewsCount: null };
    try {
      const isAdmin = isPlatformAdmin(context.session as any);
      if (!storeEnabled() && !isAdmin) return none;

      const prisma = storePrisma(context);
      const product = (await prisma.storeProduct.findUnique({
        where: { id: productId },
        select: { status: true, viewsCount: true },
      })) as { status: string; viewsCount: number | null } | null;
      if (!product || product instanceof Error || product.status !== STORE_PRODUCT_STATUS.ACTIVE) return none;

      const current = product.viewsCount ?? 0;
      if (isAdmin || isKnownCrawlerRequest(context.req) || !firstVisit(`${productId}:${visitorKey(context)}`)) {
        return { counted: false, viewsCount: shown(current, isAdmin) };
      }

      const rows = (await prisma.$queryRaw`
        UPDATE "StoreProduct" SET "viewsCount" = "viewsCount" + 1
        WHERE "id" = ${productId}
        RETURNING "viewsCount"
      `) as Array<{ viewsCount: number }> | Error;
      if (rows instanceof Error) throw rows;
      const total = Number(rows[0]?.viewsCount ?? current + 1);
      return { counted: true, viewsCount: shown(total, false) };
    } catch (error) {
      console.error("[recordStoreProductView]", error);
      return none;
    }
  },
};

export default { typeDefs, definition, resolver };
