import type { KeystoneContext } from "@keystone-6/core/types";
import { Prisma } from "@prisma/client";
import {
  ADMIN_ADS_MAX_TAKE,
  AD_KIND,
  AD_STATS_CACHE_MS,
  AD_STATS_DAYS,
  AD_TARGET_SEARCH_TAKE,
} from "../../../../models/Pet/Ad/constants";
import { normalizeSearchText } from "../../../../utils/helpers/normalizeSearchText";
import { mxToday, shiftDay } from "../../../../utils/usage/dailyUsageRollup";
import { adminPrisma, assertPlatformAdmin, clampInt, insensitive, toIso, toYmd, unwrapPrisma } from "./shared";

/**
 * Operaciones → Kadesh Pet → Anuncios. The editor writes through the generated API
 * (`createAd` / `updateAd`, admin only); these are the reads that need aggregates. See
 * models/Pet/Ad/README.md.
 */
const typeDefs = `
  type AdminAdRow {
    id: ID!
    kind: String!
    status: String!
    title: String!
    brandLabel: String!
    tone: String!
    imageUrl: String
    placements: [String!]!
    startDate: String
    endDate: String
    weight: Int!
    geoScope: String!
    zoneLabel: String!
    advertiserName: String!
    priceCents: Int!
    paymentStatus: String!
    "Name of the animal, product or clinic it promotes."
    targetLabel: String
    createdAt: String
    "In the chosen period."
    impressions: Int!
    clicks: Int!
  }

  type AdminAdList {
    total: Int!
    items: [AdminAdRow!]!
  }

  type AdminAdStatPoint {
    key: String!
    impressions: Int!
    clicks: Int!
  }

  type AdminAdStatAd {
    adId: ID!
    title: String!
    impressions: Int!
    clicks: Int!
  }

  type AdminAdStats {
    days: Int!
    impressions: Int!
    clicks: Int!
    previousImpressions: Int!
    previousClicks: Int!
    "One point per day (Mexico City), oldest first, days without events included."
    series: [AdminAdStatPoint!]!
    "key: animal_detail | vet_detail | blog | store"
    byPlacement: [AdminAdStatPoint!]!
    "Empty when the report is for one ad."
    topAds: [AdminAdStatAd!]!
    activeAds: Int!
  }

  type AdminAdTarget {
    id: ID!
    label: String!
    slug: String
    "Suggested center for an ad by zone."
    lat: Float
    lng: Float
  }
`;

const definition = `
  adminAds(take: Int, skip: Int, status: String, kind: String, search: String, days: Int): AdminAdList!
  adminAdStats(days: Int, adId: ID): AdminAdStats!
  adminAdTargets(kind: String!, search: String): [AdminAdTarget!]!
`;

const num = (value: unknown): number => Number(value) || 0;

function pickDays(value: number | null | undefined): number {
  return (AD_STATS_DAYS as readonly number[]).includes(value ?? -1) ? (value as number) : 30;
}

/** First day of the period (Mexico City) as a SQL date. */
function periodStart(days: number): string {
  return shiftDay(mxToday(), -(days - 1));
}

// One entry per period and ad; capped so it cannot grow without end.
const statsCache = new Map<string, { value: unknown; at: number }>();
const STATS_CACHE_MAX = 200;

function parseCoord(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : null;
}

const resolver = {
  adminAds: async (
    _root: unknown,
    args: { take?: number; skip?: number; status?: string; kind?: string; search?: string; days?: number },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const take = clampInt(args.take, 1, ADMIN_ADS_MAX_TAKE, 20);
    const skip = clampInt(args.skip, 0, 100_000, 0);
    const days = pickDays(args.days);
    const q = args.search?.trim();
    const where = {
      ...(args.status ? { status: args.status } : {}),
      ...(args.kind ? { kind: args.kind } : {}),
      ...(q ? { OR: [{ title: insensitive(q) }, { advertiserName: insensitive(q) }] } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.ad.count({ where }),
      prisma.ad.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take,
        skip,
        select: {
          id: true,
          kind: true,
          status: true,
          title: true,
          brandLabel: true,
          tone: true,
          image_id: true,
          image_extension: true,
          placements: true,
          startDate: true,
          endDate: true,
          weight: true,
          geoScope: true,
          zoneLabel: true,
          advertiserName: true,
          priceCents: true,
          paymentStatus: true,
          createdAt: true,
          storeProduct: { select: { name: true } },
          petPlace: { select: { name: true } },
          animal: { select: { name: true, slug: true } },
        },
      }),
    ]);
    const items = unwrapPrisma<any[]>(rows);
    const ids = items.map((row) => row.id);

    // Numbers of the whole page in one aggregate.
    const stats = new Map<string, { impressions: number; clicks: number }>();
    if (ids.length) {
      const sums = unwrapPrisma<any[]>(
        await prisma.$queryRaw`
          SELECT s."ad" AS "adId", COALESCE(sum(s."impressions"), 0)::int AS impressions,
            COALESCE(sum(s."clicks"), 0)::int AS clicks
          FROM "AdDailyStat" s
          WHERE s."ad" = ANY(${ids}::text[]) AND s."day" >= ${periodStart(days)}::date
          GROUP BY s."ad"
        `,
      );
      for (const row of sums) stats.set(row.adId, { impressions: num(row.impressions), clicks: num(row.clicks) });
    }

    const result = await Promise.all(
      items.map(async (row) => {
        let imageUrl: string | null = null;
        if (row.image_id) {
          try {
            imageUrl = await context.images("s3_ads").getUrl(row.image_id, (row.image_extension || "jpg") as any);
          } catch {
            imageUrl = null;
          }
        }
        const target = row.storeProduct?.name ?? row.petPlace?.name ?? (row.animal ? row.animal.name || row.animal.slug : null);
        return {
          id: row.id,
          kind: row.kind,
          status: row.status,
          title: row.title,
          brandLabel: row.brandLabel ?? "",
          tone: row.tone,
          imageUrl,
          placements: Array.isArray(row.placements) ? row.placements : [],
          startDate: toYmd(row.startDate),
          endDate: toYmd(row.endDate),
          weight: row.weight,
          geoScope: row.geoScope,
          zoneLabel: row.zoneLabel ?? "",
          advertiserName: row.advertiserName ?? "",
          priceCents: row.priceCents ?? 0,
          paymentStatus: row.paymentStatus,
          targetLabel: target ?? null,
          createdAt: toIso(row.createdAt),
          impressions: stats.get(row.id)?.impressions ?? 0,
          clicks: stats.get(row.id)?.clicks ?? 0,
        };
      }),
    );
    return { total: unwrapPrisma<number>(total), items: result };
  },

  adminAdStats: async (_root: unknown, args: { days?: number; adId?: string }, context: KeystoneContext) => {
    assertPlatformAdmin(context);
    const days = pickDays(args.days);
    const adId = args.adId?.trim() || null;
    const key = `${days}:${adId ?? ""}`;
    const hit = statsCache.get(key);
    if (hit && Date.now() - hit.at < AD_STATS_CACHE_MS) return hit.value;

    const prisma = adminPrisma(context);
    const from = periodStart(days);
    const previousFrom = shiftDay(from, -days);
    const forAd = adId ? Prisma.sql`AND s."ad" = ${adId}` : Prisma.empty;

    const [totals, series, placements, top, active] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          COALESCE(sum(s."impressions") FILTER (WHERE s."day" >= ${from}::date), 0)::int AS impressions,
          COALESCE(sum(s."clicks") FILTER (WHERE s."day" >= ${from}::date), 0)::int AS clicks,
          COALESCE(sum(s."impressions") FILTER (WHERE s."day" < ${from}::date), 0)::int AS "previousImpressions",
          COALESCE(sum(s."clicks") FILTER (WHERE s."day" < ${from}::date), 0)::int AS "previousClicks"
        FROM "AdDailyStat" s
        WHERE s."day" >= ${previousFrom}::date ${forAd}
      `,
      prisma.$queryRaw`
        SELECT to_char(s."day", 'YYYY-MM-DD') AS key, sum(s."impressions")::int AS impressions, sum(s."clicks")::int AS clicks
        FROM "AdDailyStat" s WHERE s."day" >= ${from}::date ${forAd}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw`
        SELECT s."placement" AS key, sum(s."impressions")::int AS impressions, sum(s."clicks")::int AS clicks
        FROM "AdDailyStat" s WHERE s."day" >= ${from}::date ${forAd}
        GROUP BY 1 ORDER BY 2 DESC
      `,
      adId
        ? Promise.resolve([])
        : prisma.$queryRaw`
            SELECT s."ad" AS "adId", max(a."title") AS title, sum(s."impressions")::int AS impressions,
              sum(s."clicks")::int AS clicks
            FROM "AdDailyStat" s JOIN "Ad" a ON a.id = s."ad"
            WHERE s."day" >= ${from}::date
            GROUP BY s."ad" ORDER BY 3 DESC LIMIT 10
          `,
      prisma.ad.count({ where: { status: "active" } }),
    ]);

    const byDay = new Map(unwrapPrisma<any[]>(series).map((row) => [row.key, row]));
    const points = [];
    for (let i = 0; i < days; i += 1) {
      const day = shiftDay(from, i);
      const row = byDay.get(day);
      points.push({ key: day, impressions: num(row?.impressions), clicks: num(row?.clicks) });
    }
    const t = unwrapPrisma<any[]>(totals)[0] ?? {};
    const value = {
      days,
      impressions: num(t.impressions),
      clicks: num(t.clicks),
      previousImpressions: num(t.previousImpressions),
      previousClicks: num(t.previousClicks),
      series: points,
      byPlacement: unwrapPrisma<any[]>(placements).map((row) => ({
        key: row.key,
        impressions: num(row.impressions),
        clicks: num(row.clicks),
      })),
      topAds: unwrapPrisma<any[]>(top).map((row) => ({
        adId: row.adId,
        title: row.title ?? "",
        impressions: num(row.impressions),
        clicks: num(row.clicks),
      })),
      activeAds: unwrapPrisma<number>(active),
    };
    if (statsCache.size >= STATS_CACHE_MAX) statsCache.clear();
    statsCache.set(key, { value, at: Date.now() });
    return value;
  },

  /** Picker of the editor: up to 20 animals, products or clinics by name. */
  adminAdTargets: async (_root: unknown, args: { kind: string; search?: string }, context: KeystoneContext) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const q = args.search?.trim() ?? "";
    const take = AD_TARGET_SEARCH_TAKE;

    if (args.kind === AD_KIND.STORE_PRODUCT) {
      const rows = unwrapPrisma<any[]>(
        await prisma.storeProduct.findMany({
          where: q ? { nameSearch: { contains: normalizeSearchText(q) } } : {},
          orderBy: [{ updatedAt: "desc" }],
          take,
          select: { id: true, name: true, slug: true },
        }),
      );
      return rows.map((row) => ({ id: row.id, label: row.name, slug: row.slug, lat: null, lng: null }));
    }

    if (args.kind === AD_KIND.PET_PLACE) {
      const rows = unwrapPrisma<any[]>(
        await prisma.petPlace.findMany({
          where: q ? { name: insensitive(q) } : {},
          orderBy: [{ name: "asc" }],
          take,
          select: { id: true, name: true, slug: true, lat: true, lng: true },
        }),
      );
      return rows.map((row) => ({
        id: row.id,
        label: row.name,
        slug: row.slug,
        lat: parseCoord(row.lat),
        lng: parseCoord(row.lng),
      }));
    }

    if (args.kind === AD_KIND.ANIMAL) {
      const rows = unwrapPrisma<any[]>(
        await prisma.animal.findMany({
          where: {
            duplicateOfId: null,
            ...(q ? { OR: [{ name: insensitive(q) }, { slug: insensitive(q) }] } : {}),
          },
          orderBy: [{ createdAt: "desc" }],
          take,
          select: { id: true, name: true, slug: true },
        }),
      );
      // Where it was last seen: the latest log of every animal of the page, in one query.
      const ids = rows.map((row) => row.id);
      const logs = ids.length
        ? unwrapPrisma<any[]>(
            await prisma.$queryRaw`
              SELECT DISTINCT ON (l."animal") l."animal" AS "animalId", l."lat", l."lng"
              FROM "AnimalLog" l
              WHERE l."animal" = ANY(${ids}::text[]) AND COALESCE(l."lat", '') <> '' AND COALESCE(l."lng", '') <> ''
              ORDER BY l."animal", l."createdAt" DESC
            `,
          )
        : [];
      const where = new Map(logs.map((log) => [log.animalId, log]));
      return rows.map((row) => ({
        id: row.id,
        label: row.name || row.slug || "Sin nombre",
        slug: row.slug,
        lat: parseCoord(where.get(row.id)?.lat),
        lng: parseCoord(where.get(row.id)?.lng),
      }));
    }
    return [];
  },
};

export default { typeDefs, definition, resolver };
