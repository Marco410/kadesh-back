import type { KeystoneContext } from "@keystone-6/core/types";
import {
  LEADERBOARD_CACHE_MS,
  LEADERBOARD_DEFAULT_TAKE,
  LEADERBOARD_MAX_TAKE,
  currentStreakWeeks,
  pawLevelFor,
  type PawLevel,
} from "../../../models/Pet/Paws/constants";
import { Role } from "../../../models/Role/constants";
import { getSessionUserId } from "../../../utils/access/tenant";
import { pawsEnabled, pawsLedgerVersion } from "../../../utils/pet/paws";
import { getPublicUserCards } from "../../../utils/pet/publicProfile";
import { mxDayWindow, mxToday } from "../../../utils/usage/dailyUsageRollup";

/**
 * Who helps the most in Kadesh Pet: ranking by paw points, all time or this month (Mexico City).
 *
 * Public. Shows name and initial of the last name, photo and a link to the public profile (none
 * of the last two when the person turned their profile off).
 * Never the full last name, contact or account id. People who hid themselves
 * (`PawAccount.rankingHidden`), staff, and suspended, anonymized or test accounts are left out.
 *
 * Cached in memory 10 min per period, or until a balance changes (`pawsLedgerVersion`): always
 * loads the top 50 and trims to `take`. Two queries on
 * a cold cache (ranking + one batched user lookup). Photo URLs are signed for 1 h, so the cache
 * stays well below that. On failure it serves the previous value.
 */
export const PAW_LEVEL_TYPE_DEFS = `
  type PawLevelInfo {
    level: Int!
    "puppy | explorer | guardian | rescuer | hero | legend"
    key: String!
    label: String!
    "Lifetime points where this level starts."
    from: Int!
    "Lifetime points where the next level starts; null at the top level."
    nextAt: Int
  }
`;

const typeDefs = `
  ${PAW_LEVEL_TYPE_DEFS}

  type PawLeaderboardEntry {
    rank: Int!
    "First name and initial of the last name («Marco C.»)."
    name: String!
    "For the /u/<username> link; null when the person turned their public profile off."
    username: String
    avatarUrl: String
    "Points in the requested period."
    points: Int!
    level: PawLevelInfo!
    streakWeeks: Int!
    "The person asking, when signed in."
    isMe: Boolean!
  }
`;

const definition = `pawLeaderboard(period: String, take: Int): [PawLeaderboardEntry!]!`;

type Period = "all_time" | "month";

type RankRow = {
  userId: string;
  points: number;
  lifetimeEarned: number;
  streakWeeks: number;
  streakWeekStart: string;
};

type CachedEntry = {
  userId: string;
  rank: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  points: number;
  level: PawLevel;
  streakWeeks: number;
};

/** `version` = `pawsLedgerVersion()` when it was built: any award or reversal since makes it stale. */
const cache = new Map<Period, { value: CachedEntry[]; at: number; version: number }>();

/** After someone opts in or out, the next request rebuilds the ranking. */
export function invalidatePawLeaderboard(): void {
  cache.clear();
}

/** Position in the cached all-time ranking, without querying. `null` when not in the top 50. */
/**
 * All-time position of one person, in ONE query and without the cache (which may be empty or a
 * few minutes old): 1 + how many ranked people have more lifetime points. Same exclusions as the
 * ranking. `null` when the person is not ranked (hidden, staff, no points, …) or below the top 50.
 */
export async function allTimeRankOf(context: KeystoneContext, userId: string): Promise<number | null> {
  try {
    const rows = await (context.sudo() as KeystoneContext & { prisma: any }).prisma.$queryRaw`
      WITH ranked AS (
        SELECT a."user", a."lifetimeEarned"
        FROM "PawAccount" a
        JOIN "User" u ON u.id = a."user"
        WHERE a."rankingHidden" = false AND a."lifetimeEarned" > 0
          AND u."suspendedAt" IS NULL AND u."anonymizedAt" IS NULL AND u."userTest" = false
          AND NOT EXISTS (
            SELECT 1 FROM "_Role_users" ru JOIN "Role" r ON r.id = ru."A"
            WHERE ru."B" = u.id AND r.name = ${Role.ADMIN}
          )
      )
      SELECT 1 + (SELECT count(*)::int FROM ranked o WHERE o."lifetimeEarned" > me."lifetimeEarned") AS rank
      FROM ranked me
      WHERE me."user" = ${userId}
    `;
    if (rows instanceof Error) throw rows;
    const rank = (rows as Array<{ rank: number }>)[0]?.rank ?? null;
    return rank && rank <= LEADERBOARD_MAX_TAKE ? rank : null;
  } catch (error) {
    console.error("[allTimeRankOf]", error);
    return null;
  }
}

function sqlTimestamp(date: Date): string {
  return date.toISOString().slice(0, 23).replace("T", " ");
}

async function loadRows(prisma: any, period: Period): Promise<RankRow[]> {
  // First day of the current month in Mexico City.
  const monthStart = sqlTimestamp(mxDayWindow(`${mxToday().slice(0, 7)}-01`).start);
  const rows =
    period === "month"
      ? await prisma.$queryRaw`
          SELECT t."user" AS "userId", sum(t.amount)::int AS points, a."lifetimeEarned",
                 a."streakWeeks", a."streakWeekStart"
          FROM "PawTransaction" t
          JOIN "PawAccount" a ON a."user" = t."user"
          JOIN "User" u ON u.id = t."user"
          WHERE t."createdAt" >= ${monthStart}::timestamp
            AND a."rankingHidden" = false
            AND u."suspendedAt" IS NULL AND u."anonymizedAt" IS NULL AND u."userTest" = false
            AND NOT EXISTS (
              SELECT 1 FROM "_Role_users" ru JOIN "Role" r ON r.id = ru."A"
              WHERE ru."B" = u.id AND r.name = ${Role.ADMIN}
            )
          GROUP BY t."user", a."lifetimeEarned", a."streakWeeks", a."streakWeekStart"
          HAVING sum(t.amount) > 0
          ORDER BY points DESC, a."lifetimeEarned" DESC, t."user" ASC
          LIMIT ${LEADERBOARD_MAX_TAKE}::int
        `
      : await prisma.$queryRaw`
          SELECT a."user" AS "userId", a."lifetimeEarned" AS points, a."lifetimeEarned",
                 a."streakWeeks", a."streakWeekStart"
          FROM "PawAccount" a
          JOIN "User" u ON u.id = a."user"
          WHERE a."rankingHidden" = false AND a."lifetimeEarned" > 0
            AND u."suspendedAt" IS NULL AND u."anonymizedAt" IS NULL AND u."userTest" = false
            AND NOT EXISTS (
              SELECT 1 FROM "_Role_users" ru JOIN "Role" r ON r.id = ru."A"
              WHERE ru."B" = u.id AND r.name = ${Role.ADMIN}
            )
          ORDER BY a."lifetimeEarned" DESC, a."updatedAt" ASC NULLS LAST, a."user" ASC
          LIMIT ${LEADERBOARD_MAX_TAKE}::int
        `;
  if (rows instanceof Error) throw rows;
  return rows as RankRow[];
}

async function loadLeaderboard(context: KeystoneContext, period: Period): Promise<CachedEntry[]> {
  const sudo = context.sudo();
  const rows = await loadRows((sudo as KeystoneContext & { prisma: any }).prisma, period);
  if (rows.length === 0) return [];

  // One batched lookup for names, photos (signed by Keystone) and profile links.
  const cards = await getPublicUserCards(context, rows.map((row) => row.userId));

  return rows.map((row, index) => {
    const card = cards.get(row.userId);
    return {
      userId: row.userId,
      rank: index + 1,
      name: card?.displayName ?? "Alguien de Kadesh",
      username: card?.username ?? null,
      avatarUrl: card?.avatarUrl ?? null,
      points: Number(row.points),
      level: pawLevelFor(Number(row.lifetimeEarned)),
      streakWeeks: currentStreakWeeks(Number(row.streakWeeks), row.streakWeekStart),
    };
  });
}

const resolver = {
  pawLeaderboard: async (
    _root: unknown,
    args: { period?: string | null; take?: number | null },
    context: KeystoneContext,
  ) => {
    if (!pawsEnabled()) return [];
    const period: Period = args.period === "month" ? "month" : "all_time";
    const requested = Math.floor(Number(args.take ?? LEADERBOARD_DEFAULT_TAKE));
    const take = Math.min(Math.max(1, Number.isFinite(requested) ? requested : LEADERBOARD_DEFAULT_TAKE), LEADERBOARD_MAX_TAKE);

    const now = Date.now();
    const version = pawsLedgerVersion();
    let cached = cache.get(period);
    if (!cached || cached.version !== version || now - cached.at >= LEADERBOARD_CACHE_MS) {
      try {
        cached = { value: await loadLeaderboard(context, period), at: now, version };
        cache.set(period, cached);
      } catch (error) {
        console.error("[pawLeaderboard]", error);
      }
    }

    const viewerId = getSessionUserId(context.session as any);
    return (cached?.value ?? []).slice(0, take).map(({ userId, ...entry }) => ({
      ...entry,
      isMe: Boolean(viewerId && viewerId === userId),
    }));
  },
};

export default { typeDefs, definition, resolver };
