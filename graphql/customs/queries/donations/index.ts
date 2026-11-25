import type { KeystoneContext } from "@keystone-6/core/types";
import {
  DONATION_CACHE_MS,
  DONATION_RANKING_MAX_TAKE,
  DONATION_STATUS,
  DONATION_WALL_MAX_TAKE,
} from "../../../../models/Pet/Donation/constants";
import { Role } from "../../../../models/Role/constants";
import { donationPrisma, donationsDataVersion } from "../../../../utils/donations/config";
import { publicDisplayName } from "../../../../utils/pet/publicProfile";
import { mxDayWindow, mxToday } from "../../../../utils/usage/dailyUsageRollup";

/**
 * Public side of «Dame una patita» (not huellitas: those are `pawLeaderboard`).
 *
 * - `donationWall`: latest paid donations with their message («Marco C. dio 3 patitas»).
 * - `donorRanking`: who gave the most patitas, this month or all time.
 * - `donationSummary`: how many people and patitas, real counts only.
 *
 * Never the email, the full last name nor the amount in pesos. Anonymous donations show as
 * «Alguien anónimo» and are never grouped together. Donations of staff and test accounts are
 * left out of the ranking. Everything is cached in memory 10 min, or until a donation is paid or
 * refunded (`donationsDataVersion`); only the first page of the wall is cached.
 */

const ANONYMOUS_NAME = "Alguien anónimo";

const typeDefs = `
  type DonationWallEntry {
    id: ID!
    "«Marco C.» or «Alguien anónimo»."
    displayName: String!
    "Patitas of this donation (1 = $25 MXN)."
    unitCount: Int!
    "Null when there is none or an admin hid it."
    message: String
    paidAt: String!
  }

  type DonationWallPage {
    items: [DonationWallEntry!]!
    hasMore: Boolean!
  }

  type DonorRankingEntry {
    rank: Int!
    displayName: String!
    "Patitas in the requested period."
    units: Int!
    "How many donations make up those patitas."
    donations: Int!
  }

  type DonationSummary {
    "People (or anonymous donations) who gave at least one patita."
    supporters: Int!
    units: Int!
    "Paid donations whose message shows on the wall (the landing shows the wall from 5)."
    wallMessages: Int!
  }
`;

const definition = `
  donationWall(take: Int, skip: Int): DonationWallPage!
  donorRanking(period: String, take: Int): [DonorRankingEntry!]!
  donationSummary: DonationSummary!
`;

type Cached<T> = { value: T; at: number; version: number };

function fresh<T>(entry: Cached<T> | undefined): entry is Cached<T> {
  return Boolean(entry && entry.version === donationsDataVersion() && Date.now() - entry.at < DONATION_CACHE_MS);
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const n = Math.floor(Number(value ?? fallback));
  return Math.min(Math.max(min, Number.isFinite(n) ? n : fallback), max);
}

function sqlTimestamp(date: Date): string {
  return date.toISOString().slice(0, 23).replace("T", " ");
}

// ─── Wall ────────────────────────────────────────────────────────────────────────────────────

type WallPage = {
  items: Array<{ id: string; displayName: string; unitCount: number; message: string | null; paidAt: string }>;
  hasMore: boolean;
};

let wallCache: Cached<WallPage> | undefined;

async function loadWall(context: KeystoneContext, take: number, skip: number): Promise<WallPage> {
  const rows = await donationPrisma(context).donation.findMany({
    where: { status: DONATION_STATUS.PAID, hideFromWall: false },
    orderBy: [{ paidAt: "desc" }, { id: "desc" }],
    take: take + 1,
    skip,
    select: { id: true, donorName: true, isAnonymous: true, unitCount: true, message: true, messageHidden: true, paidAt: true },
  });
  if (rows instanceof Error) throw rows;
  const list = rows as Array<{
    id: string;
    donorName: string | null;
    isAnonymous: boolean;
    unitCount: number;
    message: string | null;
    messageHidden: boolean;
    paidAt: Date;
  }>;
  return {
    hasMore: list.length > take,
    items: list.slice(0, take).map((row) => ({
      id: row.id,
      displayName: row.isAnonymous ? ANONYMOUS_NAME : publicDisplayName(row.donorName),
      unitCount: row.unitCount,
      message: !row.messageHidden && row.message ? row.message : null,
      paidAt: new Date(row.paidAt).toISOString(),
    })),
  };
}

// ─── Ranking ─────────────────────────────────────────────────────────────────────────────────

type Period = "month" | "all_time";
type RankingEntry = { rank: number; displayName: string; units: number; donations: number };

const rankingCache = new Map<Period, Cached<RankingEntry[]>>();

async function loadRanking(context: KeystoneContext, period: Period): Promise<RankingEntry[]> {
  const monthStart = sqlTimestamp(mxDayWindow(`${mxToday().slice(0, 7)}-01`).start);
  const since = period === "month" ? monthStart : "1970-01-01 00:00:00";
  // Anonymous donations are their own group (never merged); the shown name is the latest one used.
  const rows = await donationPrisma(context).$queryRaw`
    WITH eligible AS (
      SELECT d.id, d."donorName", d."isAnonymous", d."unitCount", d."paidAt",
             CASE WHEN d."isAnonymous" THEN 'anon:' || d.id ELSE d."donorKey" END AS "groupKey"
      FROM "Donation" d
      LEFT JOIN "User" u ON u.id = d."user"
      WHERE d.status = ${DONATION_STATUS.PAID}
        AND d."hideFromWall" = false
        AND d."paidAt" >= ${since}::timestamp
        AND (u.id IS NULL OR (
          u."userTest" = false
          AND NOT EXISTS (
            SELECT 1 FROM "_Role_users" ru JOIN "Role" r ON r.id = ru."A"
            WHERE ru."B" = u.id AND r.name = ${Role.ADMIN}
          )
        ))
    )
    SELECT "groupKey",
           sum("unitCount")::int AS units,
           count(*)::int AS donations,
           bool_or("isAnonymous") AS "isAnonymous",
           (array_agg("donorName" ORDER BY "paidAt" DESC))[1] AS "donorName",
           min("paidAt") AS "firstPaidAt"
    FROM eligible
    GROUP BY "groupKey"
    ORDER BY units DESC, "firstPaidAt" ASC
    LIMIT ${DONATION_RANKING_MAX_TAKE}::int
  `;
  if (rows instanceof Error) throw rows;
  return (rows as Array<{ units: number; donations: number; isAnonymous: boolean; donorName: string | null }>).map((row, index) => ({
    rank: index + 1,
    displayName: row.isAnonymous ? ANONYMOUS_NAME : publicDisplayName(row.donorName),
    units: Number(row.units),
    donations: Number(row.donations),
  }));
}

// ─── Summary ─────────────────────────────────────────────────────────────────────────────────

type Summary = { supporters: number; units: number; wallMessages: number };
let summaryCache: Cached<Summary> | undefined;

async function loadSummary(context: KeystoneContext): Promise<Summary> {
  const rows = await donationPrisma(context).$queryRaw`
    SELECT count(DISTINCT CASE WHEN "isAnonymous" THEN 'anon:' || id ELSE "donorKey" END)::int AS supporters,
           coalesce(sum("unitCount"), 0)::int AS units,
           count(*) FILTER (
             WHERE "hideFromWall" = false AND "messageHidden" = false AND coalesce(btrim("message"), '') <> ''
           )::int AS "wallMessages"
    FROM "Donation"
    WHERE status = ${DONATION_STATUS.PAID}
  `;
  if (rows instanceof Error) throw rows;
  const row = (rows as Array<{ supporters: number; units: number; wallMessages: number }>)[0];
  return {
    supporters: Number(row?.supporters ?? 0),
    units: Number(row?.units ?? 0),
    wallMessages: Number(row?.wallMessages ?? 0),
  };
}

const resolver = {
  donationWall: async (_root: unknown, args: { take?: number | null; skip?: number | null }, context: KeystoneContext) => {
    const take = clamp(args.take, DONATION_WALL_MAX_TAKE, 1, DONATION_WALL_MAX_TAKE);
    const skip = clamp(args.skip, 0, 0, 10_000);
    try {
      if (skip > 0) return await loadWall(context, take, skip);
      if (!fresh(wallCache)) {
        const version = donationsDataVersion();
        wallCache = { value: await loadWall(context, DONATION_WALL_MAX_TAKE, 0), at: Date.now(), version };
      }
    } catch (error) {
      console.error("[donationWall]", error);
      if (skip > 0) return { items: [], hasMore: false };
    }
    const page = wallCache?.value ?? { items: [], hasMore: false };
    return { items: page.items.slice(0, take), hasMore: page.hasMore || page.items.length > take };
  },

  donorRanking: async (_root: unknown, args: { period?: string | null; take?: number | null }, context: KeystoneContext) => {
    const period: Period = args.period === "month" ? "month" : "all_time";
    const take = clamp(args.take, DONATION_RANKING_MAX_TAKE, 1, DONATION_RANKING_MAX_TAKE);
    let cached = rankingCache.get(period);
    if (!fresh(cached)) {
      try {
        const version = donationsDataVersion();
        cached = { value: await loadRanking(context, period), at: Date.now(), version };
        rankingCache.set(period, cached);
      } catch (error) {
        console.error("[donorRanking]", error);
      }
    }
    return (cached?.value ?? []).slice(0, take);
  },

  donationSummary: async (_root: unknown, _args: unknown, context: KeystoneContext) => {
    if (!fresh(summaryCache)) {
      try {
        const version = donationsDataVersion();
        summaryCache = { value: await loadSummary(context), at: Date.now(), version };
      } catch (error) {
        console.error("[donationSummary]", error);
      }
    }
    return summaryCache?.value ?? { supporters: 0, units: 0, wallMessages: 0 };
  },
};

export default { typeDefs, definition, resolver };
