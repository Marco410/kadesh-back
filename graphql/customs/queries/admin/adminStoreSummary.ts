import type { KeystoneContext } from "@keystone-6/core/types";
import { Prisma } from "@prisma/client";
import {
  STORE_INVENTORY_POLICY,
  STORE_PAYMENT_STATUS,
  STORE_PRODUCT_SOURCE,
  STORE_PRODUCT_STATUS,
  STORE_SUMMARY_CACHE_MS,
  STORE_SUMMARY_DAYS,
  STORE_SUMMARY_DEFAULT_DAYS,
  STORE_SUMMARY_LOW_STOCK,
  STORE_SUMMARY_TOP,
} from "../../../../models/Pet/Store/constants";
import { mxDayWindow, mxToday, shiftDay } from "../../../../utils/usage/dailyUsageRollup";
import { loadStoreCovers } from "../../../../utils/store/catalog";
import { adminPrisma, assertPlatformAdmin, unwrapPrisma } from "./shared";

/**
 * Sales report of the store (Operaciones → Kadesh Pet → Tienda → Resumen). Platform admin only.
 *
 * A sale is an order that is paid today (not refunded), counted on the day it was paid, in Mexico
 * City time. Orders of test accounts are left out. Everything is aggregated in the database: nine
 * statements in two rounds plus one for the covers of the most viewed, whatever the number of
 * orders, and the answer is kept 5 minutes per period.
 */

const typeDefs = `
  type AdminStoreSummaryPoint {
    "YYYY-MM-DD (seriesUnit day) or YYYY-MM (month)."
    key: String!
    revenueCents: Float!
    orders: Int!
  }

  type AdminStoreSummarySource {
    "own | dropi"
    key: String!
    units: Int!
    "What the lines sold for, after coupons."
    revenueCents: Float!
    costCents: Float!
  }

  type AdminStoreSummaryProduct {
    productId: ID
    name: String!
    units: Int!
    revenueCents: Float!
  }

  type AdminStoreSummaryViewed {
    productId: ID!
    name: String!
    slug: String
    coverUrl: String
    "All-time views of the product page (not limited to the period)."
    views: Int!
    "All-time units sold, to compare with the views."
    salesCount: Int!
  }

  type AdminStoreSummaryCoupon {
    code: String!
    uses: Int!
    discountCents: Float!
  }

  type AdminStoreSummaryStock {
    productId: ID!
    name: String!
    stockTotal: Int!
  }

  type AdminStoreSummary {
    days: Int!
    "First and last day of the period (YYYY-MM-DD, Mexico City)."
    from: String!
    to: String!
    generatedAt: String!
    orders: Int!
    "Same number of days right before the period."
    previousOrders: Int!
    "What buyers paid: products − coupons + shipping."
    revenueCents: Float!
    previousRevenueCents: Float!
    units: Int!
    "People who bought."
    buyers: Int!
    averageOrderCents: Float!
    discountCents: Float!
    "Shipping paid by buyers."
    shippingChargedCents: Float!
    productCostCents: Float!
    "What the packages cost to send (captured on each shipment)."
    shippingCostCents: Float!
    "revenueCents − productCostCents − shippingCostCents, before payment fees."
    marginCents: Float!
    "Orders refunded in the period, by the day they were cancelled."
    refundedOrders: Int!
    refundedCents: Float!
    "day | month"
    seriesUnit: String!
    series: [AdminStoreSummaryPoint!]!
    "key: stripe_card | bank_transfer"
    byPaymentMethod: [AdminAmountCount!]!
    bySource: [AdminStoreSummarySource!]!
    topProducts: [AdminStoreSummaryProduct!]!
    topCoupons: [AdminStoreSummaryCoupon!]!
    "Active products with counted stock at zero, right now."
    outOfStock: Int!
    "Active products about to run out, right now."
    lowStock: [AdminStoreSummaryStock!]!
    "Active products with the most page views, all time."
    topViewed: [AdminStoreSummaryViewed!]!
  }
`;

const definition = `
  adminStoreSummary(days: Int): AdminStoreSummary!
`;

type Summary = Record<string, unknown>;

// One entry per allowed period (`STORE_SUMMARY_DAYS`), so it cannot grow.
const cache = new Map<number, { value: Summary; at: number }>();

const num = (value: unknown): number => Number(value) || 0;

async function computeSummary(context: KeystoneContext, days: number): Promise<Summary> {
  const prisma = adminPrisma(context);
  const today = mxToday();
  const from = shiftDay(today, -(days - 1));
  const start = mxDayWindow(from).start;
  const end = mxDayWindow(today).end;
  const previousStart = mxDayWindow(shiftDay(from, -days)).start;
  const byMonth = days > 92;

  // A sale: paid (a refund changes the status) and not from a test account.
  const paid = Prisma.sql`o."paymentStatus" = ${STORE_PAYMENT_STATUS.PAID}
    AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = o."user" AND u."userTest" = true)`;
  const inPeriod = Prisma.sql`${paid} AND o."paidAt" >= ${start}::timestamp AND o."paidAt" < ${end}::timestamp`;
  // Mexico City is UTC−6 all year.
  const bucket = byMonth
    ? Prisma.sql`to_char(o."paidAt" - interval '6 hours', 'YYYY-MM')`
    : Prisma.sql`to_char(o."paidAt" - interval '6 hours', 'YYYY-MM-DD')`;

  const [totals, extras, series, methods] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        (count(*) FILTER (WHERE o."paidAt" >= ${start}::timestamp))::int AS orders,
        COALESCE(sum(o."totalCents") FILTER (WHERE o."paidAt" >= ${start}::timestamp), 0)::float8 AS revenue,
        COALESCE(sum(o."unitsCount") FILTER (WHERE o."paidAt" >= ${start}::timestamp), 0)::int AS units,
        (count(DISTINCT o."user") FILTER (WHERE o."paidAt" >= ${start}::timestamp))::int AS buyers,
        COALESCE(sum(o."couponDiscountCents") FILTER (WHERE o."paidAt" >= ${start}::timestamp), 0)::float8 AS discount,
        COALESCE(sum(o."shippingCents") FILTER (WHERE o."paidAt" >= ${start}::timestamp), 0)::float8 AS "shippingCharged",
        COALESCE(sum(o."costCents") FILTER (WHERE o."paidAt" >= ${start}::timestamp), 0)::float8 AS "productCost",
        (count(*) FILTER (WHERE o."paidAt" < ${start}::timestamp))::int AS "previousOrders",
        COALESCE(sum(o."totalCents") FILTER (WHERE o."paidAt" < ${start}::timestamp), 0)::float8 AS "previousRevenue"
      FROM "StoreOrder" o
      WHERE ${paid} AND o."paidAt" >= ${previousStart}::timestamp AND o."paidAt" < ${end}::timestamp
    `,
    prisma.$queryRaw`
      SELECT
        (SELECT COALESCE(sum(s."shippingCostCents"), 0)::float8
           FROM "StoreShipment" s JOIN "StoreOrder" o ON o.id = s."order" WHERE ${inPeriod}) AS "shippingCost",
        (SELECT count(*)::int FROM "StoreOrder" o
           WHERE o."paymentStatus" = ${STORE_PAYMENT_STATUS.REFUNDED}
             AND o."cancelledAt" >= ${start}::timestamp AND o."cancelledAt" < ${end}::timestamp) AS "refundedOrders",
        (SELECT COALESCE(sum(o."totalCents"), 0)::float8 FROM "StoreOrder" o
           WHERE o."paymentStatus" = ${STORE_PAYMENT_STATUS.REFUNDED}
             AND o."cancelledAt" >= ${start}::timestamp AND o."cancelledAt" < ${end}::timestamp) AS "refundedCents",
        (SELECT count(*)::int FROM "StoreProduct" p
           WHERE p.status = ${STORE_PRODUCT_STATUS.ACTIVE} AND p."inventoryPolicy" = ${STORE_INVENTORY_POLICY.TRACKED}
             AND p.source <> ${STORE_PRODUCT_SOURCE.MERCADO_LIBRE}
             AND COALESCE(p."stockTotal", 0) <= 0) AS "outOfStock"
    `,
    prisma.$queryRaw`
      SELECT ${bucket} AS key, count(*)::int AS orders, COALESCE(sum(o."totalCents"), 0)::float8 AS revenue
      FROM "StoreOrder" o WHERE ${inPeriod} GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw`
      SELECT o."paymentMethod" AS key, count(*)::int AS count, COALESCE(sum(o."totalCents"), 0)::float8 AS amount
      FROM "StoreOrder" o WHERE ${inPeriod} GROUP BY 1 ORDER BY 3 DESC
    `,
  ]);

  const [sources, products, coupons, lowStock, viewed] = await Promise.all([
    prisma.$queryRaw`
      SELECT i."source" AS key, COALESCE(sum(i."quantity"), 0)::int AS units,
        COALESCE(sum(i."totalCents" - i."discountCents"), 0)::float8 AS revenue,
        COALESCE(sum(COALESCE(i."unitCostCents", 0) * i."quantity"), 0)::float8 AS cost
      FROM "StoreOrderItem" i JOIN "StoreOrder" o ON o.id = i."order"
      WHERE ${inPeriod} GROUP BY 1 ORDER BY 3 DESC
    `,
    prisma.$queryRaw`
      SELECT i."product" AS "productId", max(i."name") AS name, COALESCE(sum(i."quantity"), 0)::int AS units,
        COALESCE(sum(i."totalCents" - i."discountCents"), 0)::float8 AS revenue
      FROM "StoreOrderItem" i JOIN "StoreOrder" o ON o.id = i."order"
      WHERE ${inPeriod} GROUP BY i."product" ORDER BY 4 DESC, 3 DESC LIMIT ${STORE_SUMMARY_TOP}
    `,
    prisma.$queryRaw`
      SELECT o."couponCode" AS code, count(*)::int AS uses, COALESCE(sum(o."couponDiscountCents"), 0)::float8 AS discount
      FROM "StoreOrder" o WHERE ${inPeriod} AND COALESCE(o."couponCode", '') <> ''
      GROUP BY 1 ORDER BY 2 DESC, 3 DESC LIMIT ${STORE_SUMMARY_TOP}
    `,
    prisma.storeProduct.findMany({
      where: {
        status: STORE_PRODUCT_STATUS.ACTIVE,
        inventoryPolicy: STORE_INVENTORY_POLICY.TRACKED,
        // Affiliate products are sold on Mercado Libre: Kadesh keeps no stock of them.
        source: { not: STORE_PRODUCT_SOURCE.MERCADO_LIBRE },
        stockTotal: { gt: 0, lte: STORE_SUMMARY_LOW_STOCK },
      },
      orderBy: [{ stockTotal: "asc" }, { name: "asc" }],
      take: STORE_SUMMARY_TOP,
      select: { id: true, name: true, stockTotal: true },
    }),
    prisma.storeProduct.findMany({
      where: { status: STORE_PRODUCT_STATUS.ACTIVE, viewsCount: { gt: 0 } },
      orderBy: [{ viewsCount: "desc" }, { name: "asc" }],
      take: STORE_SUMMARY_TOP,
      select: { id: true, name: true, slug: true, viewsCount: true, salesCount: true },
    }),
  ]);

  const viewedRows = unwrapPrisma(viewed) as Array<{
    id: string;
    name: string;
    slug: string | null;
    viewsCount: number | null;
    salesCount: number | null;
  }>;
  const viewedCovers = await loadStoreCovers(context, viewedRows.map((row) => row.id));

  const total = (unwrapPrisma(totals) as Array<Record<string, unknown>>)[0] ?? {};
  const extra = (unwrapPrisma(extras) as Array<Record<string, unknown>>)[0] ?? {};
  const orders = num(total.orders);
  const revenue = num(total.revenue);
  const productCost = num(total.productCost);
  const shippingCost = num(extra.shippingCost);

  // Every day (or month) of the period, also the ones without sales.
  const sold = new Map(
    (unwrapPrisma(series) as Array<{ key: string; orders: number; revenue: number }>).map((row) => [row.key, row]),
  );
  const keys: string[] = [];
  for (let day = from; day <= today; day = shiftDay(day, 1)) {
    const key = byMonth ? day.slice(0, 7) : day;
    if (keys[keys.length - 1] !== key) keys.push(key);
  }

  return {
    days,
    from,
    to: today,
    generatedAt: new Date().toISOString(),
    orders,
    previousOrders: num(total.previousOrders),
    revenueCents: revenue,
    previousRevenueCents: num(total.previousRevenue),
    units: num(total.units),
    buyers: num(total.buyers),
    averageOrderCents: orders > 0 ? Math.round(revenue / orders) : 0,
    discountCents: num(total.discount),
    shippingChargedCents: num(total.shippingCharged),
    productCostCents: productCost,
    shippingCostCents: shippingCost,
    marginCents: revenue - productCost - shippingCost,
    refundedOrders: num(extra.refundedOrders),
    refundedCents: num(extra.refundedCents),
    seriesUnit: byMonth ? "month" : "day",
    series: keys.map((key) => ({ key, revenueCents: num(sold.get(key)?.revenue), orders: num(sold.get(key)?.orders) })),
    byPaymentMethod: (unwrapPrisma(methods) as Array<{ key: string; count: number; amount: number }>).map((row) => ({
      key: row.key || "",
      count: num(row.count),
      amount: num(row.amount),
    })),
    bySource: (unwrapPrisma(sources) as Array<{ key: string; units: number; revenue: number; cost: number }>).map((row) => ({
      key: row.key || "",
      units: num(row.units),
      revenueCents: num(row.revenue),
      costCents: num(row.cost),
    })),
    topProducts: (
      unwrapPrisma(products) as Array<{ productId: string | null; name: string | null; units: number; revenue: number }>
    ).map((row) => ({ productId: row.productId, name: row.name || "Producto", units: num(row.units), revenueCents: num(row.revenue) })),
    topCoupons: (unwrapPrisma(coupons) as Array<{ code: string; uses: number; discount: number }>).map((row) => ({
      code: row.code,
      uses: num(row.uses),
      discountCents: num(row.discount),
    })),
    outOfStock: num(extra.outOfStock),
    lowStock: (unwrapPrisma(lowStock) as Array<{ id: string; name: string; stockTotal: number | null }>).map((row) => ({
      productId: row.id,
      name: row.name,
      stockTotal: num(row.stockTotal),
    })),
    topViewed: viewedRows.map((row) => ({
      productId: row.id,
      name: row.name,
      slug: row.slug,
      coverUrl: viewedCovers.get(row.id)?.url ?? null,
      views: num(row.viewsCount),
      salesCount: num(row.salesCount),
    })),
  };
}

const resolver = {
  adminStoreSummary: async (_root: unknown, { days }: { days?: number | null }, context: KeystoneContext) => {
    assertPlatformAdmin(context);
    const period = (STORE_SUMMARY_DAYS as readonly number[]).includes(Number(days)) ? Number(days) : STORE_SUMMARY_DEFAULT_DAYS;
    const hit = cache.get(period);
    if (hit && Date.now() - hit.at < STORE_SUMMARY_CACHE_MS) return hit.value;
    const value = await computeSummary(context, period);
    cache.set(period, { value, at: Date.now() });
    return value;
  },
};

export default { typeDefs, definition, resolver };
