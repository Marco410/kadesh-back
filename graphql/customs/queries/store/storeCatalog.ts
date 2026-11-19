import type { KeystoneContext } from "@keystone-6/core/types";
import {
  STORE_CATALOG_DEFAULT_TAKE,
  STORE_CATALOG_MAX_TAKE,
  STORE_FACETS_CACHE_MS,
  STORE_INVENTORY_POLICY,
  STORE_PRODUCT_SOURCE,
  STORE_PRODUCT_STATUS,
  STORE_RELATED_TAKE,
  STORE_REVIEW_STATUS,
  STORE_REVIEWS_DEFAULT_TAKE,
  STORE_REVIEWS_MAX_TAKE,
  STORE_SEARCH_MAX_LENGTH,
  STORE_SEARCH_MIN_LENGTH,
  storeSourcesForSeller,
} from "../../../../models/Pet/Store/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { normalizeSearchText } from "../../../../utils/helpers/normalizeSearchText";
import { getPublicUserCards } from "../../../../utils/pet/publicProfile";
import {
  CATALOG_ITEM_SELECT,
  type CatalogItemRow,
  loadStoreCovers,
  storeImageUrl,
  storePrisma,
  storeStockLeft,
  toCatalogItem,
} from "../../../../utils/store/catalog";
import { storeCatalogVersion, storeEnabled } from "../../../../utils/store/config";

/**
 * Public catalog of the Kadesh Pet store (no session needed). The lists are admin only through the
 * generated API, so this is the only way a shopper reads products: nothing here returns `source`,
 * cost or supplier. Own and Dropi products both come out with `seller: "kadesh"`.
 *
 * The names avoid Keystone's generated ones (`storeProducts`, `storeProduct`,
 * `storeProductReviews`): every public store query starts with `storeCatalog`.
 *
 * With `STORE_ENABLED` off only a platform admin gets results (preview before launch).
 */

const typeDefs = `
  input StoreCatalogInput {
    search: String
    categorySlug: String
    brandSlug: String
    "AnimalType.name: dog, cat…"
    animalType: String
    "kadesh | mercado_libre"
    seller: String
    minPriceCents: Int
    maxPriceCents: Int
    onSale: Boolean
    featured: Boolean
    inStock: Boolean
    "featured (default) | newest | price_asc | price_desc | rating | best_selling"
    sort: String
    take: Int = 24
    skip: Int = 0
  }

  type StoreCatalogRef {
    slug: String!
    name: String!
  }

  type StoreCatalogItem {
    id: ID!
    slug: String!
    name: String!
    shortDescription: String
    "kadesh | mercado_libre. Own and dropshipped products are both sold by Kadesh."
    seller: String!
    "MXN cents. From the cheapest variant."
    priceCents: Int!
    "Previous price, only when it is higher than priceCents."
    compareAtPriceCents: Int
    currency: String!
    inStock: Boolean!
    "Signed for 1 h: cache pages that show it for less than that."
    coverUrl: String
    coverAlt: String
    ratingAverage: Float!
    ratingCount: Int!
    isFeatured: Boolean!
    category: StoreCatalogRef
    brand: StoreCatalogRef
    "Only for seller mercado_libre: the outbound affiliate link."
    affiliateUrl: String
    "Only for seller mercado_libre: when the price was last checked (ISO 8601)."
    priceCheckedAt: String
  }

  type StoreCatalogResult {
    total: Int!
    items: [StoreCatalogItem!]!
  }

  type StoreCatalogImage {
    url: String!
    alt: String
  }

  type StoreCatalogVariant {
    id: ID!
    title: String
    sku: String
    "Flat object: { Talla: M, Color: Rojo }"
    options: JSON
    priceCents: Int!
    compareAtPriceCents: Int
    inStock: Boolean!
    "Units left, only when stock is counted and running low."
    stockLeft: Int
  }

  type StoreCatalogProduct {
    item: StoreCatalogItem!
    description: String
    metaTitle: String
    metaDescription: String
    images: [StoreCatalogImage!]!
    variants: [StoreCatalogVariant!]!
    "AnimalType.name of each one"
    animalTypes: [String!]!
    "Published reviews with 1, 2, 3, 4 and 5 stars, in that order."
    ratingBreakdown: [Int!]!
    related: [StoreCatalogItem!]!
  }

  type StoreCatalogFacetCategory {
    id: ID!
    slug: String!
    name: String!
    parentSlug: String
    imageUrl: String
    "Active products directly in this category."
    count: Int!
  }

  type StoreCatalogFacetBrand {
    id: ID!
    slug: String!
    name: String!
    logoUrl: String
    count: Int!
  }

  type StoreCatalogFacets {
    enabled: Boolean!
    total: Int!
    categories: [StoreCatalogFacetCategory!]!
    brands: [StoreCatalogFacetBrand!]!
    minPriceCents: Int!
    maxPriceCents: Int!
  }

  type StoreCatalogReviewAuthor {
    "For the apps: lets a person hide the reviews of someone they blocked, and report or block the author."
    id: ID!
    "First name and initial of the last name."
    name: String!
    username: String
    avatarUrl: String
    level: PawLevelInfo
  }

  type StoreCatalogReview {
    id: ID!
    rating: Int!
    title: String
    body: String
    verifiedPurchase: Boolean!
    adminReply: String
    "published | hidden (hidden only ever reaches its author, in mine)"
    status: String!
    createdAt: String
    author: StoreCatalogReviewAuthor
  }

  type StoreCatalogReviewsResult {
    total: Int!
    items: [StoreCatalogReview!]!
    "The signed-in person's own review of this product, if any."
    mine: StoreCatalogReview
  }
`;

const definition = `
  storeCatalog(input: StoreCatalogInput): StoreCatalogResult!
  storeCatalogProduct(slug: String!): StoreCatalogProduct
  storeCatalogFacets: StoreCatalogFacets!
  storeCatalogReviews(productId: ID!, take: Int, skip: Int): StoreCatalogReviewsResult!
`;

type CatalogInput = {
  search?: string | null;
  categorySlug?: string | null;
  brandSlug?: string | null;
  animalType?: string | null;
  seller?: string | null;
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
  onSale?: boolean | null;
  featured?: boolean | null;
  inStock?: boolean | null;
  sort?: string | null;
  take?: number | null;
  skip?: number | null;
};

function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return value;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** Shoppers only when the store is on; a platform admin always (preview before launch). */
function canBrowse(context: KeystoneContext): boolean {
  return storeEnabled() || isPlatformAdmin(context.session);
}

/** What makes a product visible to shoppers: active and with a priced variant. */
const VISIBLE = { status: STORE_PRODUCT_STATUS.ACTIVE, priceCents: { gt: 0 } };

const IN_STOCK = {
  OR: [
    { source: STORE_PRODUCT_SOURCE.MERCADO_LIBRE },
    { inventoryPolicy: STORE_INVENTORY_POLICY.UNTRACKED },
    { stockTotal: { gt: 0 } },
  ],
};

const ORDER_BY: Record<string, Array<Record<string, "asc" | "desc">>> = {
  featured: [{ isFeatured: "desc" }, { publishedAt: "desc" }, { id: "asc" }],
  newest: [{ publishedAt: "desc" }, { id: "asc" }],
  price_asc: [{ priceCents: "asc" }, { id: "asc" }],
  price_desc: [{ priceCents: "desc" }, { id: "asc" }],
  rating: [{ ratingAverage: "desc" }, { ratingCount: "desc" }, { id: "asc" }],
  best_selling: [{ salesCount: "desc" }, { id: "asc" }],
};

async function buildWhere(prisma: any, input: CatalogInput): Promise<Record<string, unknown> | null> {
  const and: Array<Record<string, unknown>> = [VISIBLE];

  const search = normalizeSearchText(input.search).slice(0, STORE_SEARCH_MAX_LENGTH);
  if (search.length >= STORE_SEARCH_MIN_LENGTH) and.push({ nameSearch: { contains: search } });

  const categorySlug = (input.categorySlug ?? "").trim();
  if (categorySlug) {
    // The category and its children, in one query.
    const categories = unwrap(
      await prisma.storeCategory.findMany({
        where: { isActive: true, OR: [{ slug: categorySlug }, { parent: { slug: categorySlug } }] },
        select: { id: true },
      }),
    ) as Array<{ id: string }>;
    if (categories.length === 0) return null;
    and.push({ categoryId: { in: categories.map((category) => category.id) } });
  }

  const brandSlug = (input.brandSlug ?? "").trim();
  if (brandSlug) and.push({ brand: { slug: brandSlug } });

  const animalType = (input.animalType ?? "").trim();
  if (animalType) and.push({ animalTypes: { some: { name: animalType } } });

  const sources = storeSourcesForSeller(input.seller);
  if (sources) and.push({ source: { in: sources } });

  const min = Number(input.minPriceCents);
  const max = Number(input.maxPriceCents);
  if (Number.isFinite(min) && min > 0) and.push({ priceCents: { gte: Math.floor(min) } });
  if (Number.isFinite(max) && max > 0) and.push({ priceCents: { lte: Math.floor(max) } });

  if (input.onSale) and.push({ compareAtPriceCents: { not: null } });
  if (input.featured) and.push({ isFeatured: true });
  if (input.inStock) and.push(IN_STOCK);

  return { AND: and };
}

type Facets = {
  enabled: boolean;
  total: number;
  categories: Array<Record<string, unknown>>;
  brands: Array<Record<string, unknown>>;
  minPriceCents: number;
  maxPriceCents: number;
};

let facetsCache: { value: Facets; at: number; version: number } | null = null;

const EMPTY_FACETS: Facets = {
  enabled: false,
  total: 0,
  categories: [],
  brands: [],
  minPriceCents: 0,
  maxPriceCents: 0,
};

type CategoryRow = {
  id: string;
  slug: string | null;
  name: string;
  image_id: string | null;
  image_extension: string | null;
  parent: { slug: string | null } | null;
};

type BrandRow = {
  id: string;
  slug: string | null;
  name: string;
  logo_id: string | null;
  logo_extension: string | null;
};

async function computeFacets(context: KeystoneContext): Promise<Facets> {
  const prisma = storePrisma(context);
  // Two rounds instead of five queries at once: the server pool has 5 connections.
  const [categories, brands] = await Promise.all([
    prisma.storeCategory.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      take: 200,
      select: {
        id: true,
        slug: true,
        name: true,
        image_id: true,
        image_extension: true,
        parent: { select: { slug: true } },
      },
    }),
    prisma.storeBrand.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      take: 200,
      select: { id: true, slug: true, name: true, logo_id: true, logo_extension: true },
    }),
  ]);
  const [byCategory, byBrand, prices] = await Promise.all([
    prisma.storeProduct.groupBy({ by: ["categoryId"], where: VISIBLE, _count: { _all: true } }),
    prisma.storeProduct.groupBy({ by: ["brandId"], where: VISIBLE, _count: { _all: true } }),
    prisma.storeProduct.aggregate({
      where: VISIBLE,
      _min: { priceCents: true },
      _max: { priceCents: true },
      _count: { _all: true },
    }),
  ]);

  const categoryCounts = new Map<string, number>();
  for (const row of unwrap(byCategory) as Array<{ categoryId: string | null; _count: { _all: number } }>) {
    if (row.categoryId) categoryCounts.set(row.categoryId, Number(row._count._all));
  }
  const brandCounts = new Map<string, number>();
  for (const row of unwrap(byBrand) as Array<{ brandId: string | null; _count: { _all: number } }>) {
    if (row.brandId) brandCounts.set(row.brandId, Number(row._count._all));
  }
  const totals = unwrap(prices) as {
    _min: { priceCents: number | null };
    _max: { priceCents: number | null };
    _count: { _all: number };
  };

  const categoryList = await Promise.all(
    (unwrap(categories) as CategoryRow[])
      .filter((row) => row.slug)
      .map(async (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        parentSlug: row.parent?.slug ?? null,
        imageUrl: await storeImageUrl(context, {
          image_id: row.image_id,
          image_extension: row.image_extension,
          externalUrl: null,
        }),
        count: categoryCounts.get(row.id) ?? 0,
      })),
  );
  const brandList = await Promise.all(
    (unwrap(brands) as BrandRow[])
      .filter((row) => row.slug && brandCounts.has(row.id))
      .map(async (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        logoUrl: await storeImageUrl(context, {
          image_id: row.logo_id,
          image_extension: row.logo_extension,
          externalUrl: null,
        }),
        count: brandCounts.get(row.id) ?? 0,
      })),
  );

  return {
    enabled: true,
    total: Number(totals._count._all) || 0,
    categories: categoryList,
    brands: brandList,
    minPriceCents: Number(totals._min.priceCents) || 0,
    maxPriceCents: Number(totals._max.priceCents) || 0,
  };
}

type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  verifiedPurchase: boolean | null;
  adminReply: string | null;
  status: string;
  createdAt: Date | null;
  userId: string | null;
};

const REVIEW_SELECT = {
  id: true,
  rating: true,
  title: true,
  body: true,
  verifiedPurchase: true,
  adminReply: true,
  status: true,
  createdAt: true,
  userId: true,
} as const;

const resolver = {
  /** Product list for /tienda and the app. Three queries however many products come back. */
  storeCatalog: async (_root: unknown, { input }: { input?: CatalogInput | null }, context: KeystoneContext) => {
    if (!canBrowse(context)) return { total: 0, items: [] };
    const filters = input ?? {};
    const prisma = storePrisma(context);
    const take = clamp(filters.take, 1, STORE_CATALOG_MAX_TAKE, STORE_CATALOG_DEFAULT_TAKE);
    const skip = clamp(filters.skip, 0, 100_000, 0);

    const where = await buildWhere(prisma, filters);
    if (!where) return { total: 0, items: [] };
    const orderBy = ORDER_BY[filters.sort ?? ""] ?? ORDER_BY.featured;

    const [rows, total] = await Promise.all([
      prisma.storeProduct.findMany({ where, orderBy, take, skip, select: CATALOG_ITEM_SELECT }),
      prisma.storeProduct.count({ where }),
    ]);
    const products = unwrap(rows) as CatalogItemRow[];
    const covers = await loadStoreCovers(
      context,
      products.map((product) => product.id),
    );
    return {
      total: Number(unwrap(total)) || 0,
      items: products.map((product) => toCatalogItem(product, covers.get(product.id))),
    };
  },

  /** One product by slug, with its photos, variants, star breakdown and related products. */
  storeCatalogProduct: async (_root: unknown, { slug }: { slug: string }, context: KeystoneContext) => {
    if (!canBrowse(context)) return null;
    const cleanSlug = (slug ?? "").trim();
    if (!cleanSlug) return null;
    const prisma = storePrisma(context);
    // An admin can open a draft or paused product to preview it.
    const visibility = isPlatformAdmin(context.session) ? {} : VISIBLE;

    const product = unwrap(
      await prisma.storeProduct.findFirst({
        where: { slug: cleanSlug, ...visibility },
        select: {
          ...CATALOG_ITEM_SELECT,
          description: true,
          metaTitle: true,
          metaDescription: true,
          categoryId: true,
          animalTypes: { select: { name: true } },
        },
      }),
    ) as
      | (CatalogItemRow & {
          description: string | null;
          metaTitle: string | null;
          metaDescription: string | null;
          categoryId: string | null;
          animalTypes: Array<{ name: string }>;
        })
      | null;
    if (!product) return null;

    const [variants, images, breakdown, related] = await Promise.all([
      prisma.storeProductVariant.findMany({
        where: { productId: product.id, isActive: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        take: 100,
        select: {
          id: true,
          title: true,
          sku: true,
          options: true,
          priceCents: true,
          compareAtPriceCents: true,
          stock: true,
        },
      }),
      prisma.storeProductImage.findMany({
        where: { productId: product.id },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        take: 24,
        select: { image_id: true, image_extension: true, externalUrl: true, alt: true },
      }),
      prisma.storeProductReview.groupBy({
        by: ["rating"],
        where: { productId: product.id, status: STORE_REVIEW_STATUS.PUBLISHED },
        _count: { _all: true },
      }),
      product.categoryId
        ? prisma.storeProduct.findMany({
            where: { ...VISIBLE, categoryId: product.categoryId, id: { not: product.id } },
            orderBy: [{ salesCount: "desc" }, { ratingCount: "desc" }, { id: "asc" }],
            take: STORE_RELATED_TAKE,
            select: CATALOG_ITEM_SELECT,
          })
        : Promise.resolve([]),
    ]);

    const relatedRows = unwrap(related) as CatalogItemRow[];
    const covers = await loadStoreCovers(context, [product.id, ...relatedRows.map((row) => row.id)]);

    const imageList = (
      await Promise.all(
        (
          unwrap(images) as Array<{
            image_id: string | null;
            image_extension: string | null;
            externalUrl: string | null;
            alt: string | null;
          }>
        ).map(async (image) => ({ url: await storeImageUrl(context, image), alt: image.alt || null })),
      )
    ).filter((image): image is { url: string; alt: string | null } => Boolean(image.url));

    const ratingBreakdown = [0, 0, 0, 0, 0];
    for (const row of unwrap(breakdown) as Array<{ rating: number; _count: { _all: number } }>) {
      const stars = Number(row.rating);
      if (stars >= 1 && stars <= 5) ratingBreakdown[stars - 1] = Number(row._count._all);
    }

    const tracked = product.inventoryPolicy === STORE_INVENTORY_POLICY.TRACKED;
    const affiliate = product.source === STORE_PRODUCT_SOURCE.MERCADO_LIBRE;

    return {
      item: toCatalogItem(product, covers.get(product.id)),
      description: product.description || null,
      metaTitle: product.metaTitle || null,
      metaDescription: product.metaDescription || null,
      images: imageList,
      variants: (
        unwrap(variants) as Array<{
          id: string;
          title: string | null;
          sku: string | null;
          options: unknown;
          priceCents: number | null;
          compareAtPriceCents: number | null;
          stock: number | null;
        }>
      ).map((variant) => {
        const price = Number(variant.priceCents) || 0;
        const compare = Number(variant.compareAtPriceCents) || 0;
        return {
          id: variant.id,
          title: variant.title || null,
          sku: variant.sku || null,
          options: variant.options ?? null,
          priceCents: price,
          compareAtPriceCents: compare > price ? compare : null,
          inStock: affiliate || !tracked || (Number(variant.stock) || 0) > 0,
          stockLeft: affiliate ? null : storeStockLeft(product.inventoryPolicy, variant.stock),
        };
      }),
      animalTypes: product.animalTypes.map((type) => type.name),
      ratingBreakdown,
      related: relatedRows.map((row) => toCatalogItem(row, covers.get(row.id))),
    };
  },

  /** Categories, brands and price range for the filters. Cached in memory for 10 minutes. */
  storeCatalogFacets: async (_root: unknown, _args: unknown, context: KeystoneContext) => {
    if (!canBrowse(context)) return EMPTY_FACETS;
    const version = storeCatalogVersion();
    if (
      facetsCache &&
      facetsCache.version === version &&
      Date.now() - facetsCache.at < STORE_FACETS_CACHE_MS
    ) {
      return facetsCache.value;
    }
    const value = await computeFacets(context);
    facetsCache = { value, at: Date.now(), version };
    return value;
  },

  /** Published reviews of a product, newest first, plus the caller's own review. */
  storeCatalogReviews: async (
    _root: unknown,
    args: { productId: string; take?: number | null; skip?: number | null },
    context: KeystoneContext,
  ) => {
    const empty = { total: 0, items: [], mine: null };
    if (!canBrowse(context) || !args.productId) return empty;
    const prisma = storePrisma(context);
    const take = clamp(args.take, 1, STORE_REVIEWS_MAX_TAKE, STORE_REVIEWS_DEFAULT_TAKE);
    const skip = clamp(args.skip, 0, 100_000, 0);
    const where = { productId: args.productId, status: STORE_REVIEW_STATUS.PUBLISHED };
    const userId = getSessionUserId(context.session);

    const [rows, total, own] = await Promise.all([
      prisma.storeProductReview.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take,
        skip,
        select: REVIEW_SELECT,
      }),
      prisma.storeProductReview.count({ where }),
      userId
        ? prisma.storeProductReview.findUnique({
            where: { key: `${userId}:${args.productId}` },
            select: REVIEW_SELECT,
          })
        : Promise.resolve(null),
    ]);
    const reviews = unwrap(rows) as ReviewRow[];
    const mine = unwrap(own) as ReviewRow | null;

    // Names, photos and levels of every author in two queries.
    const cards = await getPublicUserCards(context, [...reviews.map((review) => review.userId), mine?.userId]);
    const toReview = (review: ReviewRow) => {
      const card = review.userId ? cards.get(review.userId) : undefined;
      return {
        id: review.id,
        rating: Number(review.rating),
        title: review.title || null,
        body: review.body || null,
        verifiedPurchase: Boolean(review.verifiedPurchase),
        adminReply: review.adminReply || null,
        status: review.status,
        createdAt: review.createdAt ? new Date(review.createdAt).toISOString() : null,
        author: card
          ? { id: review.userId, name: card.displayName, username: card.username, avatarUrl: card.avatarUrl, level: card.level }
          : null,
      };
    };

    return {
      total: Number(unwrap(total)) || 0,
      items: reviews.map(toReview),
      mine: mine ? toReview(mine) : null,
    };
  },
};

export default { typeDefs, definition, resolver };
