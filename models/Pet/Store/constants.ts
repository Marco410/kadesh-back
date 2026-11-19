/**
 * Kadesh Pet store: every enum and limit lives here. See README.md for the rules behind them.
 * Changing a limit needs no migration.
 */

/** Where a product comes from. Internal: the public API only exposes `seller`. */
export const STORE_PRODUCT_SOURCE = {
  /** Kadesh's own product, shipped by Kadesh. */
  OWN: "own",
  /** Dropshipping: Kadesh charges, Dropi fulfills. Shown to shoppers as sold by Kadesh. */
  DROPI: "dropi",
  /** Affiliate link: the purchase happens on Mercado Libre. */
  MERCADO_LIBRE: "mercado_libre",
} as const;

export type StoreProductSource = (typeof STORE_PRODUCT_SOURCE)[keyof typeof STORE_PRODUCT_SOURCE];

export const STORE_PRODUCT_SOURCE_OPTIONS = [
  { label: "Propio", value: STORE_PRODUCT_SOURCE.OWN },
  { label: "Dropi", value: STORE_PRODUCT_SOURCE.DROPI },
  { label: "Mercado Libre (afiliado)", value: STORE_PRODUCT_SOURCE.MERCADO_LIBRE },
];

/** What shoppers see as the seller. Own and Dropi products are both "kadesh". */
export const STORE_SELLER = {
  KADESH: "kadesh",
  MERCADO_LIBRE: "mercado_libre",
} as const;

export type StoreSeller = (typeof STORE_SELLER)[keyof typeof STORE_SELLER];

export function storeSellerFor(source: string | null | undefined): StoreSeller {
  return source === STORE_PRODUCT_SOURCE.MERCADO_LIBRE ? STORE_SELLER.MERCADO_LIBRE : STORE_SELLER.KADESH;
}

/** The sources behind a public seller filter. */
export function storeSourcesForSeller(seller: string | null | undefined): StoreProductSource[] | null {
  if (seller === STORE_SELLER.KADESH) return [STORE_PRODUCT_SOURCE.OWN, STORE_PRODUCT_SOURCE.DROPI];
  if (seller === STORE_SELLER.MERCADO_LIBRE) return [STORE_PRODUCT_SOURCE.MERCADO_LIBRE];
  return null;
}

export const STORE_PRODUCT_STATUS = {
  DRAFT: "draft",
  /** The only status shoppers can see. */
  ACTIVE: "active",
  PAUSED: "paused",
  ARCHIVED: "archived",
} as const;

export type StoreProductStatus = (typeof STORE_PRODUCT_STATUS)[keyof typeof STORE_PRODUCT_STATUS];

export const STORE_PRODUCT_STATUS_OPTIONS = [
  { label: "Borrador", value: STORE_PRODUCT_STATUS.DRAFT },
  { label: "Activo", value: STORE_PRODUCT_STATUS.ACTIVE },
  { label: "Pausado", value: STORE_PRODUCT_STATUS.PAUSED },
  { label: "Archivado", value: STORE_PRODUCT_STATUS.ARCHIVED },
];

export const STORE_INVENTORY_POLICY = {
  /** Stock is counted; at zero the product shows as sold out. */
  TRACKED: "tracked",
  /** Sold without stock (made or ordered on demand): always available. */
  UNTRACKED: "untracked",
} as const;

export const STORE_INVENTORY_POLICY_OPTIONS = [
  { label: "Con stock contado", value: STORE_INVENTORY_POLICY.TRACKED },
  { label: "Sin stock (sobre pedido)", value: STORE_INVENTORY_POLICY.UNTRACKED },
];

export const STORE_REVIEW_STATUS = {
  PUBLISHED: "published",
  /** Hidden by an admin: it stops counting toward the product's stars. */
  HIDDEN: "hidden",
} as const;

export const STORE_REVIEW_STATUS_OPTIONS = [
  { label: "Publicada", value: STORE_REVIEW_STATUS.PUBLISHED },
  { label: "Oculta", value: STORE_REVIEW_STATUS.HIDDEN },
];

export const STORE_CURRENCY = "MXN";

export const STORE_CATALOG_DEFAULT_TAKE = 24;
export const STORE_CATALOG_MAX_TAKE = 48;
export const STORE_RELATED_TAKE = 8;
export const STORE_REVIEWS_DEFAULT_TAKE = 10;
export const STORE_REVIEWS_MAX_TAKE = 20;
export const STORE_ADMIN_MAX_TAKE = 100;

/** Saved products per person. */
export const STORE_WISHLIST_MAX = 500;

/** Image URLs are signed for 1 h: this cache must stay well below that. */
export const STORE_FACETS_CACHE_MS = 10 * 60 * 1000;

/** With tracked stock at or below this, shoppers see how many are left. */
export const STORE_LOW_STOCK = 5;

export const STORE_SEARCH_MIN_LENGTH = 2;
export const STORE_SEARCH_MAX_LENGTH = 80;

export const STORE_REVIEW_TITLE_MAX = 120;
export const STORE_REVIEW_BODY_MAX = 2000;

/** Static routes under `/tienda/` that a product slug must not collide with. */
export const STORE_RESERVED_SLUGS = new Set([
  "carrito",
  "pagar",
  "pedidos",
  "deseos",
  "categoria",
  "marca",
  "buscar",
  "c",
  "m",
]);
