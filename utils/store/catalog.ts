import type { KeystoneContext } from "@keystone-6/core/types";
import {
  STORE_CART_MAX_QUANTITY,
  STORE_CURRENCY,
  STORE_INVENTORY_POLICY,
  STORE_LOW_STOCK,
  STORE_PRODUCT_SOURCE,
  STORE_REVIEW_STATUS,
  STORE_SELLER,
  storeSellerFor,
} from "../../models/Pet/Store/constants";
import { bumpStoreCatalogVersion } from "./config";

/**
 * Catalog helpers of the Kadesh Pet store: the stored totals of a product (price, stock, stars)
 * and the public shape of a product. Shoppers never get `source`, cost or supplier: every public
 * resolver builds its answer with `toCatalogItem`.
 */

export function storePrisma(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return value;
}

type ImageExtension = "jpg" | "png" | "webp" | "gif";

/**
 * Copies onto the product what lists and filters need without joining its variants: the price of
 * the cheapest active variant and the stock of all of them. Two queries.
 *
 * `priceTouched` = a variant price was just written: for Mercado Libre products that is the date
 * the price was last checked by hand.
 */
export async function recomputeStoreProductTotals(
  context: KeystoneContext,
  productId: string | null | undefined,
  options: { priceTouched?: boolean } = {},
): Promise<void> {
  if (!productId) return;
  try {
    const prisma = storePrisma(context);
    const variants = unwrap(
      await prisma.storeProductVariant.findMany({
        where: { productId, isActive: true },
        select: { priceCents: true, compareAtPriceCents: true, stock: true },
      }),
    ) as Array<{ priceCents: number | null; compareAtPriceCents: number | null; stock: number | null }>;

    let cheapest: (typeof variants)[number] | null = null;
    let stockTotal = 0;
    for (const variant of variants) {
      stockTotal += Math.max(0, Number(variant.stock) || 0);
      const price = Number(variant.priceCents) || 0;
      if (price > 0 && (!cheapest || price < Number(cheapest.priceCents))) cheapest = variant;
    }
    const priceCents = cheapest ? Number(cheapest.priceCents) : 0;
    const compare = cheapest ? Number(cheapest.compareAtPriceCents) || 0 : 0;

    const data: Record<string, unknown> = {
      priceCents,
      // Only kept when it is a real discount, so "on sale" is a plain `not null` filter.
      compareAtPriceCents: compare > priceCents ? compare : null,
      stockTotal,
    };
    if (options.priceTouched) {
      const product = unwrap(
        await prisma.storeProduct.findUnique({ where: { id: productId }, select: { source: true } }),
      ) as { source: string } | null;
      if (product?.source === STORE_PRODUCT_SOURCE.MERCADO_LIBRE) data.externalSyncedAt = new Date();
    }
    unwrap(await prisma.storeProduct.updateMany({ where: { id: productId }, data }));
    bumpStoreCatalogVersion();
  } catch (error) {
    console.error("[store] could not recompute product totals:", productId, error);
  }
}

/** Stars of a product from its published reviews, in one statement. */
export async function recomputeStoreProductRating(
  context: KeystoneContext,
  productId: string | null | undefined,
): Promise<{ ratingAverage: number; ratingCount: number } | null> {
  if (!productId) return null;
  const prisma = storePrisma(context);
  const rows = await prisma.$queryRaw`
    UPDATE "StoreProduct" p
    SET "ratingAverage" = s.average, "ratingCount" = s.total
    FROM (
      SELECT COALESCE(round(avg(r.rating)::numeric, 2), 0)::float8 AS average, count(*)::int AS total
      FROM "StoreProductReview" r
      WHERE r."product" = ${productId} AND r.status = ${STORE_REVIEW_STATUS.PUBLISHED}
    ) s
    WHERE p.id = ${productId}
    RETURNING p."ratingAverage", p."ratingCount"
  `;
  if (rows instanceof Error) throw rows;
  const row = (rows as Array<{ ratingAverage: number; ratingCount: number }>)[0];
  return row ? { ratingAverage: Number(row.ratingAverage), ratingCount: Number(row.ratingCount) } : null;
}

export type StoreCover = { url: string | null; alt: string | null };

type ImageRow = {
  productId: string;
  image_id: string | null;
  image_extension: string | null;
  externalUrl: string | null;
  alt: string | null;
};

/** Signed URL of an uploaded image, or the external one (Mercado Libre) when nothing was uploaded. */
export async function storeImageUrl(
  context: KeystoneContext,
  row: { image_id: string | null; image_extension: string | null; externalUrl: string | null },
): Promise<string | null> {
  if (row.image_id) {
    try {
      const extension = (row.image_extension || "jpg") as ImageExtension;
      return await context.images("s3_store").getUrl(row.image_id, extension);
    } catch (error) {
      console.error("[store] could not sign image:", row.image_id, error);
    }
  }
  return row.externalUrl || null;
}

/** Cover (lowest `order`) of many products in ONE query. Never ask for it per row. */
export async function loadStoreCovers(
  context: KeystoneContext,
  productIds: string[],
): Promise<Map<string, StoreCover>> {
  const covers = new Map<string, StoreCover>();
  if (productIds.length === 0) return covers;
  const rows = await storePrisma(context).$queryRaw`
    SELECT DISTINCT ON (i."product")
      i."product" AS "productId", i."image_id", i."image_extension", i."externalUrl", i."alt"
    FROM "StoreProductImage" i
    WHERE i."product" = ANY(${productIds}::text[])
    ORDER BY i."product", i."order" ASC, i."createdAt" ASC
  `;
  if (rows instanceof Error) throw rows;
  await Promise.all(
    (rows as ImageRow[]).map(async (row) => {
      covers.set(row.productId, { url: await storeImageUrl(context, row), alt: row.alt || null });
    }),
  );
  return covers;
}

/** Variants on sale (active, with a price) of a product: how many, and the id when there is only one. */
export type StoreSaleVariants = { count: number; singleId: string | null };

/**
 * Variants on sale of many products in ONE query, so a card can offer "Agregar al carrito" when
 * there is nothing to choose. Never ask for it per row.
 */
export async function loadStoreSaleVariants(
  context: KeystoneContext,
  productIds: string[],
): Promise<Map<string, StoreSaleVariants>> {
  const result = new Map<string, StoreSaleVariants>();
  if (productIds.length === 0) return result;
  const rows = await storePrisma(context).storeProductVariant.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, isActive: true, priceCents: { gt: 0 } },
    _count: { _all: true },
    _min: { id: true },
  });
  if (rows instanceof Error) throw rows;
  for (const row of rows as Array<{ productId: string | null; _count: { _all: number }; _min: { id: string | null } }>) {
    if (!row.productId) continue;
    const count = Number(row._count._all) || 0;
    result.set(row.productId, { count, singleId: count === 1 ? row._min.id : null });
  }
  return result;
}

/** Prisma `select` of everything `toCatalogItem` needs. Nothing internal beyond `source`. */
export const CATALOG_ITEM_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  source: true,
  priceCents: true,
  compareAtPriceCents: true,
  inventoryPolicy: true,
  stockTotal: true,
  ratingAverage: true,
  ratingCount: true,
  isFeatured: true,
  affiliateUrl: true,
  externalSyncedAt: true,
  category: { select: { slug: true, name: true } },
  brand: { select: { slug: true, name: true } },
} as const;

export type CatalogItemRow = {
  id: string;
  slug: string | null;
  name: string;
  shortDescription: string | null;
  source: string;
  priceCents: number | null;
  compareAtPriceCents: number | null;
  inventoryPolicy: string | null;
  stockTotal: number | null;
  ratingAverage: number | null;
  ratingCount: number | null;
  isFeatured: boolean | null;
  affiliateUrl: string | null;
  externalSyncedAt: Date | null;
  category: { slug: string | null; name: string } | null;
  brand: { slug: string | null; name: string } | null;
};

export function isStoreItemInStock(row: {
  source: string;
  inventoryPolicy: string | null;
  stockTotal: number | null;
}): boolean {
  if (row.source === STORE_PRODUCT_SOURCE.MERCADO_LIBRE) return true;
  if (row.inventoryPolicy === STORE_INVENTORY_POLICY.UNTRACKED) return true;
  return (Number(row.stockTotal) || 0) > 0;
}

/** Units left to show ("quedan 3"), only when stock is counted and running low. */
export function storeStockLeft(inventoryPolicy: string | null, stock: number | null): number | null {
  if (inventoryPolicy !== STORE_INVENTORY_POLICY.TRACKED) return null;
  const left = Math.max(0, Number(stock) || 0);
  return left > 0 && left <= STORE_LOW_STOCK ? left : null;
}

/** The public shape of a product. Own and Dropi products both come out as sold by Kadesh. */
export function toCatalogItem(row: CatalogItemRow, cover: StoreCover | undefined, variants?: StoreSaleVariants) {
  const seller = storeSellerFor(row.source);
  const isAffiliate = seller === STORE_SELLER.MERCADO_LIBRE;
  const inStock = isStoreItemInStock(row);
  return {
    id: row.id,
    slug: row.slug ?? row.id,
    name: row.name,
    shortDescription: row.shortDescription || null,
    seller,
    priceCents: Number(row.priceCents) || 0,
    compareAtPriceCents: row.compareAtPriceCents ? Number(row.compareAtPriceCents) : null,
    currency: STORE_CURRENCY,
    inStock,
    variantsCount: isAffiliate ? 0 : variants?.count ?? 0,
    // Straight to the cart from a card: sold by Kadesh, in stock and nothing to choose.
    singleVariantId: !isAffiliate && inStock ? variants?.singleId ?? null : null,
    // How many of that variant a card may put in the cart: its stock, up to the per-line cap.
    singleVariantMaxQuantity:
      !isAffiliate && inStock && variants?.singleId
        ? row.inventoryPolicy === STORE_INVENTORY_POLICY.TRACKED
          ? Math.min(Math.max(0, Number(row.stockTotal) || 0), STORE_CART_MAX_QUANTITY)
          : STORE_CART_MAX_QUANTITY
        : null,
    coverUrl: cover?.url ?? null,
    coverAlt: cover?.alt ?? null,
    ratingAverage: Number(row.ratingAverage) || 0,
    ratingCount: Number(row.ratingCount) || 0,
    isFeatured: Boolean(row.isFeatured),
    category: row.category?.slug ? { slug: row.category.slug, name: row.category.name } : null,
    brand: row.brand?.slug ? { slug: row.brand.slug, name: row.brand.name } : null,
    // Only affiliate products carry an outbound link and the date their price was last checked.
    affiliateUrl: isAffiliate ? row.affiliateUrl || null : null,
    priceCheckedAt: isAffiliate && row.externalSyncedAt ? new Date(row.externalSyncedAt).toISOString() : null,
  };
}

/** Catalog items for these ids, keeping the given order. Three queries (products, then covers and variants). */
export async function loadCatalogItems(
  context: KeystoneContext,
  where: Record<string, unknown>,
  order: string[],
) {
  if (order.length === 0) return [];
  const rows = unwrap(
    await storePrisma(context).storeProduct.findMany({
      where: { ...where, id: { in: order } },
      select: CATALOG_ITEM_SELECT,
    }),
  ) as CatalogItemRow[];
  const ids = rows.map((row) => row.id);
  const [covers, variants] = await Promise.all([loadStoreCovers(context, ids), loadStoreSaleVariants(context, ids)]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return order
    .filter((id) => byId.has(id))
    .map((id) => toCatalogItem(byId.get(id)!, covers.get(id), variants.get(id)));
}

export function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
