import type { KeystoneContext } from "@keystone-6/core/types";
import { PET_PLACE_VIEW_DEDUPE_MS, PET_PLACE_VIEWS_PUBLIC_MIN } from "../../../../../models/Pet/PetPlace/const";
import { getSessionUserId, isPlatformAdmin } from "../../../../../utils/access/tenant";
import { requestIp, requestUserAgent } from "../../../../../utils/activity/requestMeta";
import { isKnownCrawlerRequest } from "../../../../../utils/security/knownCrawlers";
import { createDeduper } from "../../../../../utils/security/rateLimit";

const typeDefs = `
  type PetPlaceViewResult {
    "Whether this visit counted. The owner, admins, bots and repeats within 30 min do not."
    counted: Boolean!
    "Total views to show, or null while the clinic has fewer than the public minimum (the owner and admins always get it)."
    viewsCount: Int
  }
`;

const definition = `
  recordPetPlaceView(placeId: ID!): PetPlaceViewResult!
`;

/** In process memory: after a restart someone may add one extra view. Good enough. */
const firstVisit = createDeduper(PET_PLACE_VIEW_DEDUPE_MS);

/** With a session, the person; without one, IP + browser (IP alone would merge a shared network). */
function visitorKey(context: KeystoneContext): string {
  const userId = getSessionUserId(context.session);
  if (userId) return `u:${userId}`;
  return `ip:${requestIp(context.req) ?? "?"}|${requestUserAgent(context.req) ?? ""}`;
}

function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

const resolver = {
  /**
   * The clinic page calls it once when it opens and shows the total it returns. Uses the existing
   * `PetPlace.views` column, added with raw SQL so no hook runs. Never fails outward: on any error
   * it answers `counted: false` and the page shows no number.
   */
  recordPetPlaceView: async (_root: unknown, { placeId }: { placeId: string }, context: KeystoneContext) => {
    const none = { counted: false, viewsCount: null };
    try {
      const prisma = prismaOf(context);
      const place = (await prisma.petPlace.findUnique({
        where: { id: placeId },
        select: { userId: true, views: true },
      })) as { userId: string | null; views: number | null } | null;
      if (!place || place instanceof Error) return none;

      const userId = getSessionUserId(context.session);
      const isOwner = Boolean(userId && userId === place.userId);
      const isAdmin = isPlatformAdmin(context.session as any);
      const shown = (total: number) =>
        isOwner || isAdmin || total >= PET_PLACE_VIEWS_PUBLIC_MIN ? total : null;

      const current = place.views ?? 0;
      if (isOwner || isAdmin || isKnownCrawlerRequest(context.req) || !firstVisit(`${placeId}:${visitorKey(context)}`)) {
        return { counted: false, viewsCount: shown(current) };
      }

      const rows = (await prisma.$queryRaw`
        UPDATE "PetPlace" SET "views" = COALESCE("views", 0) + 1
        WHERE "id" = ${placeId}
        RETURNING "views"
      `) as Array<{ views: number }> | Error;
      if (rows instanceof Error) throw rows;
      return { counted: true, viewsCount: shown(Number(rows[0]?.views ?? current + 1)) };
    } catch (error) {
      console.error("[recordPetPlaceView]", error);
      return none;
    }
  },
};

export default { typeDefs, definition, resolver };
