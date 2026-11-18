import type { KeystoneContext } from "@keystone-6/core/types";
import {
  MY_PAWS_HISTORY_TAKE,
  currentStreakWeeks,
  mxWeekStart,
  pawLevelFor,
} from "../../../models/Pet/Paws/constants";
import { getSessionUserId } from "../../../utils/access/tenant";
import { pawsEnabled } from "../../../utils/pet/paws";
import { cachedAllTimeRank } from "./pawLeaderboard";

/**
 * Paw points of the signed-in person: balance, level, streak and their latest movements.
 *
 * Two queries (account by its unique user + the last 20 ledger rows by the `(user, createdAt)`
 * index). The fronts ask for it when the profile opens; it is not meant to be polled.
 * `myPawHistory` pages the rest of the ledger.
 */
const HISTORY_MAX_TAKE = 50;

const typeDefs = `
  type PawHistoryEntry {
    id: ID!
    "report_published | sighting | case_closed | reunion_helped | adoption_completed | event_approved | comment | review | first_pet | first_health_record | rescue_verified | place_verified | referral | streak_bonus | admin_adjust"
    action: String!
    "earn | reversal | adjust | spend"
    kind: String!
    "Signed: negative when points were taken back or spent."
    amount: Int!
    balanceAfter: Int
    createdAt: String!
  }

  type MyPaws {
    "False while the feature is switched off: the fronts hide the section."
    enabled: Boolean!
    "Spendable points."
    balance: Int!
    "Points that count for the level."
    lifetimeEarned: Int!
    level: PawLevelInfo!
    "Points missing for the next level; null at the top level."
    toNextLevel: Int
    "Consecutive weeks helping. 0 when the streak expired."
    streakWeeks: Int!
    bestStreakWeeks: Int!
    "The streak already counts this week."
    streakActiveThisWeek: Boolean!
    rankingHidden: Boolean!
    "Position in the all-time ranking when it is inside the top 50 and already cached."
    rank: Int
    history: [PawHistoryEntry!]!
  }
`;

const definition = `
  myPaws: MyPaws
  myPawHistory(take: Int, skip: Int): [PawHistoryEntry!]!
`;

type AccountRow = {
  balance: number;
  lifetimeEarned: number;
  streakWeeks: number;
  bestStreakWeeks: number;
  streakWeekStart: string;
  rankingHidden: boolean;
};

type HistoryRow = {
  id: string;
  action: string;
  kind: string;
  amount: number;
  balanceAfter: number | null;
  createdAt: Date | null;
};

function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

async function loadHistory(context: KeystoneContext, userId: string, take: number, skip: number) {
  const rows = await prismaOf(context).pawTransaction.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    skip,
    select: { id: true, action: true, kind: true, amount: true, balanceAfter: true, createdAt: true },
  });
  if (rows instanceof Error) throw rows;
  return (rows as HistoryRow[]).map((row) => ({
    ...row,
    createdAt: (row.createdAt ? new Date(row.createdAt) : new Date()).toISOString(),
  }));
}

function emptyPaws(enabled: boolean) {
  const level = pawLevelFor(0);
  return {
    enabled,
    balance: 0,
    lifetimeEarned: 0,
    level,
    toNextLevel: level.nextAt,
    streakWeeks: 0,
    bestStreakWeeks: 0,
    streakActiveThisWeek: false,
    rankingHidden: false,
    rank: null,
    history: [],
  };
}

const resolver = {
  myPaws: async (_root: unknown, _args: unknown, context: KeystoneContext) => {
    const userId = getSessionUserId(context.session as any);
    if (!userId) return null;
    if (!pawsEnabled()) return emptyPaws(false);
    try {
      const account = (await prismaOf(context).pawAccount.findFirst({
        where: { userId },
        select: {
          balance: true,
          lifetimeEarned: true,
          streakWeeks: true,
          bestStreakWeeks: true,
          streakWeekStart: true,
          rankingHidden: true,
        },
      })) as AccountRow | Error | null;
      if (account instanceof Error) throw account;
      if (!account) return emptyPaws(true);

      const level = pawLevelFor(account.lifetimeEarned);
      return {
        enabled: true,
        balance: account.balance,
        lifetimeEarned: account.lifetimeEarned,
        level,
        toNextLevel: level.nextAt === null ? null : Math.max(0, level.nextAt - account.lifetimeEarned),
        streakWeeks: currentStreakWeeks(account.streakWeeks, account.streakWeekStart),
        bestStreakWeeks: account.bestStreakWeeks,
        streakActiveThisWeek: account.streakWeekStart === mxWeekStart(),
        rankingHidden: account.rankingHidden,
        rank: account.rankingHidden ? null : cachedAllTimeRank(userId),
        history: await loadHistory(context, userId, MY_PAWS_HISTORY_TAKE, 0),
      };
    } catch (error) {
      console.error("[myPaws]", error);
      return emptyPaws(true);
    }
  },

  myPawHistory: async (
    _root: unknown,
    args: { take?: number | null; skip?: number | null },
    context: KeystoneContext,
  ) => {
    const userId = getSessionUserId(context.session as any);
    if (!userId || !pawsEnabled()) return [];
    const take = Math.min(Math.max(1, Math.floor(Number(args.take ?? MY_PAWS_HISTORY_TAKE)) || MY_PAWS_HISTORY_TAKE), HISTORY_MAX_TAKE);
    const skip = Math.max(0, Math.floor(Number(args.skip ?? 0)) || 0);
    try {
      return await loadHistory(context, userId, take, skip);
    } catch (error) {
      console.error("[myPawHistory]", error);
      return [];
    }
  },
};

export default { typeDefs, definition, resolver };
