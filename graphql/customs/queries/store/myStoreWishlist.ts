import type { KeystoneContext } from "@keystone-6/core/types";
import {
  STORE_CATALOG_DEFAULT_TAKE,
  STORE_CATALOG_MAX_TAKE,
  STORE_PRODUCT_STATUS,
  STORE_WISHLIST_MAX,
} from "../../../../models/Pet/Store/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { loadCatalogItems, storePrisma } from "../../../../utils/store/catalog";
import { storeEnabled } from "../../../../utils/store/config";

/**
 * The signed-in person's saved products. `myStoreWishlistIds` is what a product grid needs to
 * paint the hearts: one query for the whole page, never one per card.
 */

const definition = `
  myStoreWishlist(take: Int, skip: Int): StoreCatalogResult!
  myStoreWishlistIds: [ID!]!
`;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function canBrowse(context: KeystoneContext): boolean {
  return storeEnabled() || isPlatformAdmin(context.session);
}

const resolver = {
  /** Saved products, newest first. Products no longer for sale are left out. */
  myStoreWishlist: async (
    _root: unknown,
    args: { take?: number | null; skip?: number | null },
    context: KeystoneContext,
  ) => {
    const userId = getSessionUserId(context.session);
    if (!userId || !canBrowse(context)) return { total: 0, items: [] };
    const prisma = storePrisma(context);
    const take = clamp(args.take, 1, STORE_CATALOG_MAX_TAKE, STORE_CATALOG_DEFAULT_TAKE);
    const skip = clamp(args.skip, 0, STORE_WISHLIST_MAX, 0);
    const where = { userId, product: { status: STORE_PRODUCT_STATUS.ACTIVE } };

    const [rows, total] = await Promise.all([
      prisma.storeWishlistItem.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take,
        skip,
        select: { productId: true },
      }),
      prisma.storeWishlistItem.count({ where }),
    ]);
    if (rows instanceof Error) throw rows;
    if (total instanceof Error) throw total;
    const ids = (rows as Array<{ productId: string | null }>)
      .map((row) => row.productId)
      .filter((id): id is string => Boolean(id));
    const items = await loadCatalogItems(context, { status: STORE_PRODUCT_STATUS.ACTIVE }, ids);
    return { total: Number(total) || 0, items };
  },

  /** Ids of every saved product (one query). */
  myStoreWishlistIds: async (_root: unknown, _args: unknown, context: KeystoneContext) => {
    const userId = getSessionUserId(context.session);
    if (!userId || !canBrowse(context)) return [];
    const rows = await storePrisma(context).storeWishlistItem.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      take: STORE_WISHLIST_MAX,
      select: { productId: true },
    });
    if (rows instanceof Error) throw rows;
    return (rows as Array<{ productId: string | null }>)
      .map((row) => row.productId)
      .filter((id): id is string => Boolean(id));
  },
};

export default { typeDefs: "", definition, resolver };
