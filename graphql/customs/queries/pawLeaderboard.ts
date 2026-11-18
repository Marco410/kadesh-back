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
import { pawsEnabled } from "../../../utils/pet/paws";
import { mxDayWindow, mxToday } from "../../../utils/usage/dailyUsageRollup";

/**
 * Who helps the most in Kadesh Pet: ranking by paw points, all time or this month (Mexico City).
 *
 * Public. Shows only what the report map already shows about a person: first name and photo.
 * Never the last name, username, contact or account id. People who hid themselves
 * (`PawAccount.rankingHidden`), staff, and suspended, anonymized or test accounts are left out.
 *
 * Cached in memory 10 min per period: always loads the top 50 and trims to `take`. Two queries on
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
    "First name only."
    name: String!
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
  avatarUrl: string | null;
  points: number;
  level: PawLevel;
  streakWeeks: number;
};

const cache = new Map<Period, { value: CachedEntry[]; at: number }>();

/** After someone opts in or out, the next request rebuilds the ranking. */
export function invalidatePawLeaderboard(): void {
  cache.clear();
}

/** Position in the cached all-time ranking, without querying. `null` when not in the top 50. */
export function cachedAllTimeRank(userId: string): number | null {
  const entry = cache.get("all_time")?.value.find((row) => row.userId === userId);
  return entry ? entry.rank : null;
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

  // One batched lookup for names and photos (the photo URL is signed by Keystone).
  const people = (await sudo.query.User.findMany({
    where: { id: { in: rows.map((row) => row.userId) } },
    query: "id name profileImage { url }",
  })) as Array<{ id: string; name?: string | null; profileImage?: { url?: string | null } | null }>;
  const byId = new Map(people.map((person) => [person.id, person]));

  return rows.map((row, index) => {
    const person = byId.get(row.userId);
    return {
      userId: row.userId,
      rank: index + 1,
      name: (person?.name ?? "").trim() || "Alguien de Kadesh",
      avatarUrl: person?.profileImage?.url ?? null,
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
    let cached = cache.get(period);
    if (!cached || now - cached.at >= LEADERBOARD_CACHE_MS) {
      try {
        cached = { value: await loadLeaderboard(context, period), at: now };
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
