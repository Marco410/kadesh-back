import type { KeystoneContext } from "@keystone-6/core/types";
import {
  STORE_COUPON_TYPE,
  STORE_MIN_ORDER_TOTAL_CENTS,
  STORE_ORDER_STATUS,
  STORE_PAYMENT_STATUS,
} from "../../models/Pet/Store/constants";
import { normalizeCouponCode } from "../../models/Pet/Store/StoreCoupon/StoreCoupon";
import { storePrisma } from "./catalog";

/**
 * Discount codes of the store: whether a code applies to a cart and how much it takes off, and
 * the bookkeeping of its uses.
 *
 * The same check runs for the cart preview and for placing the order. A use is taken with one
 * conditional increment (`usedCount < usageLimit`), so a coupon cannot go past its limit when two
 * orders arrive together, and it is handed back if the order is cancelled unpaid or refunded.
 */

/** A cart line as the coupon needs it. */
export type CouponLine = {
  variantId: string;
  productId: string | null;
  categoryId: string | null;
  parentCategoryId: string | null;
  lineTotalCents: number;
};

export type CouponOutcome =
  | { applied: false; code: string; message: string }
  | {
      applied: true;
      code: string;
      couponId: string;
      /** Off the products. 0 for a free-shipping coupon. */
      discountCents: number;
      freeShipping: boolean;
      /** How the discount splits across lines (by `variantId`), for the order's records. */
      perLine: Map<string, number>;
      message: string;
    };

type CouponRow = {
  id: string;
  code: string;
  type: string;
  value: number;
  minSubtotalCents: number | null;
  maxDiscountCents: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usedCount: number;
  firstOrderOnly: boolean | null;
  isActive: boolean | null;
  categories: Array<{ id: string }>;
  products: Array<{ id: string }>;
};

const MONEY_WHOLE = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const MONEY_CENTS = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

/** "$50" for whole pesos, "$8.90" otherwise: the amount the person sees is the one they get. */
const MONEY = { format: (pesos: number) => (Number.isInteger(pesos) ? MONEY_WHOLE : MONEY_CENTS).format(pesos) };

function no(code: string, message: string): CouponOutcome {
  return { applied: false, code, message };
}

/** Splits `discount` across lines in proportion to their totals; the last one takes the rounding. */
function allocate(lines: CouponLine[], discount: number): Map<string, number> {
  const perLine = new Map<string, number>();
  const base = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  if (discount <= 0 || base <= 0) return perLine;
  let left = discount;
  lines.forEach((line, index) => {
    const share = index === lines.length - 1 ? left : Math.min(left, Math.floor((discount * line.lineTotalCents) / base));
    perLine.set(line.variantId, Math.min(share, line.lineTotalCents));
    left -= share;
  });
  return perLine;
}

/**
 * Does this code apply to this cart, for this person? Up to three queries (the coupon, and the
 * person's uses and paid orders only when the coupon limits them).
 *
 * Without a session the per-person rules are not checked: they are when the order is placed, where
 * there is always an account.
 */
export async function evaluateCoupon(
  context: KeystoneContext,
  input: {
    code: string | null | undefined;
    lines: CouponLine[];
    subtotalCents: number;
    shippingCents: number;
    userId: string | null;
  },
): Promise<CouponOutcome | null> {
  const code = normalizeCouponCode(input.code);
  if (!code) return null;
  const prisma = storePrisma(context);
  const coupon = (await prisma.storeCoupon.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      type: true,
      value: true,
      minSubtotalCents: true,
      maxDiscountCents: true,
      startsAt: true,
      endsAt: true,
      usageLimit: true,
      usageLimitPerUser: true,
      usedCount: true,
      firstOrderOnly: true,
      isActive: true,
      categories: { select: { id: true } },
      products: { select: { id: true } },
    },
  })) as CouponRow | Error | null;
  if (coupon instanceof Error) throw coupon;

  const now = Date.now();
  if (!coupon) return no(code, "Ese cupón no existe.");
  if (coupon.isActive === false) return no(code, "Ese cupón ya no está activo.");
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return no(code, "Ese cupón todavía no empieza.");
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() <= now) return no(code, "Ese cupón ya venció.");
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return no(code, "Ese cupón ya se agotó.");
  if (coupon.minSubtotalCents && input.subtotalCents < coupon.minSubtotalCents) {
    return no(code, `Ese cupón aplica desde ${MONEY.format(coupon.minSubtotalCents / 100)} de compra.`);
  }

  if (input.userId) {
    if (coupon.usageLimitPerUser != null) {
      const used = await prisma.storeCouponRedemption.count({ where: { couponId: coupon.id, userId: input.userId } });
      if (used instanceof Error) throw used;
      if (Number(used) >= coupon.usageLimitPerUser) return no(code, "Ya usaste ese cupón.");
    }
    if (coupon.firstOrderOnly) {
      // A paid order, or another unpaid one already holding this coupon: otherwise someone could
      // leave several transfers waiting, each with the first-purchase discount, and pay them all.
      // Cancelling or letting the unpaid one expire frees the coupon again.
      const earlier = await prisma.storeOrder.count({
        where: {
          userId: input.userId,
          OR: [
            { paymentStatus: { in: [STORE_PAYMENT_STATUS.PAID, STORE_PAYMENT_STATUS.REFUNDED] } },
            {
              couponCode: coupon.code,
              status: STORE_ORDER_STATUS.OPEN,
              paymentStatus: { in: [STORE_PAYMENT_STATUS.PENDING, STORE_PAYMENT_STATUS.IN_REVIEW] },
            },
          ],
        },
      });
      if (earlier instanceof Error) throw earlier;
      if (Number(earlier) > 0) return no(code, "Ese cupón es solo para tu primera compra.");
    }
  }

  const categoryIds = new Set(coupon.categories.map((category) => category.id));
  const productIds = new Set(coupon.products.map((product) => product.id));
  const scoped = categoryIds.size > 0 || productIds.size > 0;
  const eligible = input.lines.filter(
    (line) =>
      line.lineTotalCents > 0 &&
      (!scoped ||
        (line.productId && productIds.has(line.productId)) ||
        (line.categoryId && categoryIds.has(line.categoryId)) ||
        (line.parentCategoryId && categoryIds.has(line.parentCategoryId))),
  );
  if (eligible.length === 0) return no(code, "Ese cupón no aplica a los productos de tu carrito.");

  if (coupon.type === STORE_COUPON_TYPE.FREE_SHIPPING) {
    if (input.shippingCents <= 0) return no(code, "Tu envío ya es gratis: guarda ese cupón para otra compra.");
    return {
      applied: true,
      code,
      couponId: coupon.id,
      discountCents: 0,
      freeShipping: true,
      perLine: new Map(),
      message: "Cupón aplicado: envío gratis.",
    };
  }

  const eligibleTotal = eligible.reduce((sum, line) => sum + line.lineTotalCents, 0);
  let discount =
    coupon.type === STORE_COUPON_TYPE.PERCENT
      ? Math.floor((eligibleTotal * Math.min(100, Math.max(0, coupon.value))) / 100)
      : Math.max(0, coupon.value);
  if (coupon.maxDiscountCents) discount = Math.min(discount, coupon.maxDiscountCents);
  discount = Math.min(discount, eligibleTotal);
  // Never below what a card can be charged.
  discount = Math.min(discount, Math.max(0, input.subtotalCents + input.shippingCents - STORE_MIN_ORDER_TOTAL_CENTS));
  if (discount <= 0) return no(code, "Ese cupón no aplica a un pedido de este monto.");

  return {
    applied: true,
    code,
    couponId: coupon.id,
    discountCents: discount,
    freeShipping: false,
    perLine: allocate(eligible, discount),
    message: `Cupón aplicado: ${MONEY.format(discount / 100)} de descuento.`,
  };
}

/**
 * Takes one use of the coupon for an order. `false` when the coupon just ran out (someone else
 * took the last use): the order must not go on with that discount.
 */
export async function reserveCoupon(
  context: KeystoneContext,
  input: { couponId: string; orderId: string; userId: string; discountCents: number },
): Promise<boolean> {
  const prisma = storePrisma(context);
  const taken = await prisma.$queryRaw`
    UPDATE "StoreCoupon" SET "usedCount" = "usedCount" + 1
    WHERE "id" = ${input.couponId} AND "isActive" = true
      AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
    RETURNING "id", "usageLimitPerUser"
  `;
  if (taken instanceof Error) throw taken;
  const coupon = (taken as Array<{ id: string; usageLimitPerUser: number | null }>)[0];
  if (!coupon) return false;

  const created = await prisma.storeCouponRedemption.create({
    data: {
      key: `${input.couponId}:${input.orderId}`,
      coupon: { connect: { id: input.couponId } },
      order: { connect: { id: input.orderId } },
      user: { connect: { id: input.userId } },
      discountCents: input.discountCents,
    },
  });
  if (created instanceof Error) {
    // Could not record the use: hand it back so the count stays true.
    const undone = await prisma.$queryRaw`
      UPDATE "StoreCoupon" SET "usedCount" = GREATEST(0, "usedCount" - 1) WHERE "id" = ${input.couponId} RETURNING "id"
    `;
    if (undone instanceof Error) console.error("[store] could not undo coupon use:", input.couponId, undone);
    throw created;
  }

  // The per-person limit, checked again with this use already written: two orders of the same
  // person placed together cannot both keep it.
  if (coupon.usageLimitPerUser != null) {
    const mine = await prisma.storeCouponRedemption.count({ where: { couponId: input.couponId, userId: input.userId } });
    if (mine instanceof Error) throw mine;
    if (Number(mine) > coupon.usageLimitPerUser) {
      await releaseStoreOrderCoupon(context, input.orderId);
      return false;
    }
  }
  return true;
}

/**
 * Hands back the coupon use of an order (cancelled unpaid, or refunded). One statement and
 * idempotent: the redemption is deleted in it, so a second call finds nothing to hand back.
 */
export async function releaseStoreOrderCoupon(context: KeystoneContext, orderId: string): Promise<void> {
  try {
    const rows = await storePrisma(context).$queryRaw`
      WITH gone AS (
        DELETE FROM "StoreCouponRedemption" r WHERE r."order" = ${orderId} RETURNING r."coupon" AS coupon
      )
      UPDATE "StoreCoupon" c SET "usedCount" = GREATEST(0, c."usedCount" - g.n)
      FROM (SELECT coupon, count(*)::int AS n FROM gone WHERE coupon IS NOT NULL GROUP BY coupon) g
      WHERE c."id" = g.coupon
      RETURNING c."id"
    `;
    if (rows instanceof Error) throw rows;
  } catch (error) {
    console.error("[store] could not release the coupon of an order:", orderId, error);
  }
}
