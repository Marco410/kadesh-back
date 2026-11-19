import type { KeystoneContext } from "@keystone-6/core/types";
import { STORE_ADMIN_MAX_TAKE, STORE_INVENTORY_POLICY } from "../../../../models/Pet/Store/constants";
import { normalizeSearchText } from "../../../../utils/helpers/normalizeSearchText";
import { loadStoreCovers } from "../../../../utils/store/catalog";
import { adminPrisma, assertPlatformAdmin, clampInt, countsToList, toIso, unwrapPrisma } from "./shared";

/**
 * Store products in Operaciones (Kadesh Pet → Tienda). Platform admin only. Unlike the public
 * catalog this one shows `source`, every status and the stock.
 *
 * Used instead of the generated `storeProducts` because a list needs the cover and the variant
 * count of every row, and Keystone resolves to-many relations one query per row. Here they are two
 * batched queries. The detail and every write use the generated API (`storeProduct`,
 * `createStoreProduct`, `updateStoreProductVariant`…).
 */

const typeDefs = `
  type AdminStoreProductRow {
    id: ID!
    name: String!
    slug: String
    "own | dropi | mercado_libre"
    source: String!
    "draft | active | paused | archived"
    status: String!
    priceCents: Int!
    compareAtPriceCents: Int
    "tracked | untracked"
    inventoryPolicy: String!
    stockTotal: Int!
    variantsCount: Int!
    ratingAverage: Float!
    ratingCount: Int!
    salesCount: Int!
    isFeatured: Boolean!
    externalId: String
    category: String
    brand: String
    coverUrl: String
    createdAt: String
    updatedAt: String
  }

  type AdminStoreProductsResult {
    total: Int!
    items: [AdminStoreProductRow!]!
    "Products per status, ignoring the status filter (for the filter chips)."
    statusCounts: [AdminCount!]!
  }
`;

const definition = `
  adminStoreProducts(
    search: String
    source: String
    status: String
    categoryId: ID
    brandId: ID
    "true = tracked products with no stock left"
    outOfStock: Boolean
    take: Int
    skip: Int
  ): AdminStoreProductsResult!
`;

type Args = {
  search?: string | null;
  source?: string | null;
  status?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  outOfStock?: boolean | null;
  take?: number | null;
  skip?: number | null;
};

type Row = {
  id: string;
  name: string;
  slug: string | null;
  source: string;
  status: string;
  priceCents: number | null;
  compareAtPriceCents: number | null;
  inventoryPolicy: string;
  stockTotal: number | null;
  ratingAverage: number | null;
  ratingCount: number | null;
  salesCount: number | null;
  isFeatured: boolean | null;
  externalId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  category: { name: string } | null;
  brand: { name: string } | null;
};

const resolver = {
  adminStoreProducts: async (_root: unknown, args: Args, context: KeystoneContext) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const take = clampInt(args.take, 1, STORE_ADMIN_MAX_TAKE, 25);
    const skip = clampInt(args.skip, 0, 1_000_000, 0);

    // Everything but the status, so the chips can show how many there are of each.
    const base: Array<Record<string, unknown>> = [];
    const search = normalizeSearchText(args.search);
    if (search) {
      base.push({
        OR: [
          { nameSearch: { contains: search } },
          { externalId: { equals: (args.search ?? "").trim() } },
          { variants: { some: { sku: { equals: (args.search ?? "").trim() } } } },
        ],
      });
    }
    if (args.source) base.push({ source: args.source });
    if (args.categoryId) base.push({ categoryId: args.categoryId });
    if (args.brandId) base.push({ brandId: args.brandId });
    if (args.outOfStock) base.push({ inventoryPolicy: STORE_INVENTORY_POLICY.TRACKED, stockTotal: { lte: 0 } });

    const where = { AND: args.status ? [...base, { status: args.status }] : base };

    const [rows, total, byStatus] = await Promise.all([
      prisma.storeProduct.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take,
        skip,
        select: {
          id: true,
          name: true,
          slug: true,
          source: true,
          status: true,
          priceCents: true,
          compareAtPriceCents: true,
          inventoryPolicy: true,
          stockTotal: true,
          ratingAverage: true,
          ratingCount: true,
          salesCount: true,
          isFeatured: true,
          externalId: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { name: true } },
          brand: { select: { name: true } },
        },
      }),
      prisma.storeProduct.count({ where }),
      prisma.storeProduct.groupBy({ by: ["status"], where: { AND: base }, _count: { _all: true } }),
    ]);
    const products = unwrapPrisma(rows) as Row[];
    const ids = products.map((product) => product.id);

    // Covers and variant counts of the whole page: one query each.
    const [covers, variantGroups] = await Promise.all([
      loadStoreCovers(context, ids),
      ids.length > 0
        ? prisma.storeProductVariant.groupBy({
            by: ["productId"],
            where: { productId: { in: ids } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);
    const variantCounts = new Map<string, number>();
    for (const group of unwrapPrisma(variantGroups) as Array<{ productId: string | null; _count: { _all: number } }>) {
      if (group.productId) variantCounts.set(group.productId, Number(group._count._all));
    }

    return {
      total: Number(unwrapPrisma(total)) || 0,
      items: products.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        source: product.source,
        status: product.status,
        priceCents: Number(product.priceCents) || 0,
        compareAtPriceCents: product.compareAtPriceCents ? Number(product.compareAtPriceCents) : null,
        inventoryPolicy: product.inventoryPolicy,
        stockTotal: Number(product.stockTotal) || 0,
        variantsCount: variantCounts.get(product.id) ?? 0,
        ratingAverage: Number(product.ratingAverage) || 0,
        ratingCount: Number(product.ratingCount) || 0,
        salesCount: Number(product.salesCount) || 0,
        isFeatured: Boolean(product.isFeatured),
        externalId: product.externalId,
        category: product.category?.name ?? null,
        brand: product.brand?.name ?? null,
        coverUrl: covers.get(product.id)?.url ?? null,
        createdAt: toIso(product.createdAt),
        updatedAt: toIso(product.updatedAt),
      })),
      statusCounts: countsToList(
        (unwrapPrisma(byStatus) as Array<{ status: string; _count: { _all: number } }>).map((group) => ({
          key: group.status,
          count: Number(group._count._all),
        })),
      ),
    };
  },
};

export default { typeDefs, definition, resolver };
