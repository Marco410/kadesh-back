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

// ─── Orders (phase 2) ───────────────────────────────────────────────────────────────────────

/** Life of the order as a whole. */
export const STORE_ORDER_STATUS = {
  OPEN: "open",
  /** Paid and every shipment delivered. */
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const STORE_ORDER_STATUS_OPTIONS = [
  { label: "Abierto", value: STORE_ORDER_STATUS.OPEN },
  { label: "Completado", value: STORE_ORDER_STATUS.COMPLETED },
  { label: "Cancelado", value: STORE_ORDER_STATUS.CANCELLED },
];

export const STORE_PAYMENT_STATUS = {
  PENDING: "pending",
  /** Bank transfer with a proof uploaded, waiting for an admin. */
  IN_REVIEW: "in_review",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;

export const STORE_PAYMENT_STATUS_OPTIONS = [
  { label: "Pendiente", value: STORE_PAYMENT_STATUS.PENDING },
  { label: "Comprobante en revisión", value: STORE_PAYMENT_STATUS.IN_REVIEW },
  { label: "Pagado", value: STORE_PAYMENT_STATUS.PAID },
  { label: "Falló", value: STORE_PAYMENT_STATUS.FAILED },
  { label: "Reembolsado", value: STORE_PAYMENT_STATUS.REFUNDED },
];

export const STORE_FULFILLMENT_STATUS = {
  UNFULFILLED: "unfulfilled",
  /** Some shipments are on their way or delivered, not all. */
  PARTIAL: "partial",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  RETURNED: "returned",
} as const;

export const STORE_FULFILLMENT_STATUS_OPTIONS = [
  { label: "Por surtir", value: STORE_FULFILLMENT_STATUS.UNFULFILLED },
  { label: "Parcial", value: STORE_FULFILLMENT_STATUS.PARTIAL },
  { label: "Enviado", value: STORE_FULFILLMENT_STATUS.SHIPPED },
  { label: "Entregado", value: STORE_FULFILLMENT_STATUS.DELIVERED },
  { label: "Devuelto", value: STORE_FULFILLMENT_STATUS.RETURNED },
];

export const STORE_PAYMENT_METHOD = {
  CARD: "stripe_card",
  TRANSFER: "bank_transfer",
} as const;

export type StorePaymentMethod = (typeof STORE_PAYMENT_METHOD)[keyof typeof STORE_PAYMENT_METHOD];

export const STORE_PAYMENT_METHOD_OPTIONS = [
  { label: "Tarjeta (Stripe)", value: STORE_PAYMENT_METHOD.CARD },
  { label: "Transferencia", value: STORE_PAYMENT_METHOD.TRANSFER },
];

/** One attempt to pay an order (`StorePayment.status`). */
export const STORE_PAYMENT_ATTEMPT_STATUS = {
  PENDING: "pending",
  IN_REVIEW: "in_review",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
} as const;

export const STORE_PAYMENT_ATTEMPT_STATUS_OPTIONS = Object.values(STORE_PAYMENT_ATTEMPT_STATUS).map((value) => ({
  label: value,
  value,
}));

export const STORE_SHIPMENT_PROVIDER = {
  /** Shipped by Kadesh. */
  OWN: "own",
  /** Fulfilled by Dropi. Never shown to shoppers. */
  DROPI: "dropi",
} as const;

export const STORE_SHIPMENT_PROVIDER_OPTIONS = [
  { label: "Kadesh", value: STORE_SHIPMENT_PROVIDER.OWN },
  { label: "Dropi", value: STORE_SHIPMENT_PROVIDER.DROPI },
];

export const STORE_SHIPMENT_STATUS = {
  /** Paid, nothing done yet (own products). */
  PENDING: "pending",
  /** Paid, waiting for an admin to send the order to Dropi. */
  PENDING_APPROVAL: "pending_approval",
  /** Sent to Dropi, no label yet. */
  REQUESTED: "requested",
  LABEL_CREATED: "label_created",
  IN_TRANSIT: "in_transit",
  DELIVERED: "delivered",
  /** Something went wrong on the way (address, lost, refused). */
  EXCEPTION: "exception",
  RETURNED: "returned",
  CANCELLED: "cancelled",
} as const;

export type StoreShipmentStatus = (typeof STORE_SHIPMENT_STATUS)[keyof typeof STORE_SHIPMENT_STATUS];

export const STORE_SHIPMENT_STATUS_OPTIONS = [
  { label: "Por preparar", value: STORE_SHIPMENT_STATUS.PENDING },
  { label: "Por aprobar", value: STORE_SHIPMENT_STATUS.PENDING_APPROVAL },
  { label: "Solicitado", value: STORE_SHIPMENT_STATUS.REQUESTED },
  { label: "Guía generada", value: STORE_SHIPMENT_STATUS.LABEL_CREATED },
  { label: "En camino", value: STORE_SHIPMENT_STATUS.IN_TRANSIT },
  { label: "Entregado", value: STORE_SHIPMENT_STATUS.DELIVERED },
  { label: "Incidencia", value: STORE_SHIPMENT_STATUS.EXCEPTION },
  { label: "Devuelto", value: STORE_SHIPMENT_STATUS.RETURNED },
  { label: "Cancelado", value: STORE_SHIPMENT_STATUS.CANCELLED },
];

/** Shipment statuses that mean the package already left. */
export const STORE_SHIPMENT_ON_THE_WAY: readonly string[] = [
  STORE_SHIPMENT_STATUS.LABEL_CREATED,
  STORE_SHIPMENT_STATUS.IN_TRANSIT,
];

/** What happened to an order (`StoreOrderEvent.type`): its timeline. */
export const STORE_ORDER_EVENT = {
  PLACED: "placed",
  PAYMENT_FAILED: "payment_failed",
  TRANSFER_PROOF_UPLOADED: "transfer_proof_uploaded",
  TRANSFER_REJECTED: "transfer_rejected",
  PAID: "paid",
  PAID_AFTER_CANCEL: "paid_after_cancel",
  SHIPMENT_UPDATED: "shipment_updated",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  REFUNDED: "refunded",
  NOTE: "note",
} as const;

export const STORE_ORDER_CHANNEL = { WEB: "web", APP: "app" } as const;

export const STORE_ORDERS_DEFAULT_TAKE = 10;
export const STORE_ORDERS_MAX_TAKE = 20;

/** Lines and units a cart may carry. */
export const STORE_CART_MAX_LINES = 50;
export const STORE_CART_MAX_QUANTITY = 20;

export const STORE_ADDRESS_MAX = 10;
export const STORE_GUEST_MIN_PASSWORD = 8;

/** Proof of a bank transfer: an image of up to this size. */
export const STORE_TRANSFER_PROOF_MAX_BYTES = 8 * 1024 * 1024;

/** After a rejected proof the person has this long to upload another before the order expires. */
export const STORE_TRANSFER_RETRY_HOURS = 24;

/** Orders checked per run of `expireStoreOrders`. */
export const STORE_EXPIRE_MAX_PER_RUN = 200;

/** `StoreSettings` is read from memory for this long (and re-read right after an admin edits it). */
export const STORE_SETTINGS_CACHE_MS = 60 * 1000;

export const STORE_SETTINGS_DEFAULTS = {
  shippingFlatCents: 9900,
  freeShippingMinCents: 79900,
  cardEnabled: true,
  transferEnabled: true,
  transferExpiryHours: 48,
  cardExpiryMinutes: 60,
} as const;

// ─── Coupons (phase 4) ──────────────────────────────────────────────────────────────────────

export const STORE_COUPON_TYPE = {
  /** `value` is a whole percent (10 = 10 %) of the lines the coupon applies to. */
  PERCENT: "percent",
  /** `value` is MXN cents off. */
  FIXED: "fixed",
  /** Shipping is free; `value` is ignored. */
  FREE_SHIPPING: "free_shipping",
} as const;

export const STORE_COUPON_TYPE_OPTIONS = [
  { label: "Porcentaje", value: STORE_COUPON_TYPE.PERCENT },
  { label: "Monto fijo", value: STORE_COUPON_TYPE.FIXED },
  { label: "Envío gratis", value: STORE_COUPON_TYPE.FREE_SHIPPING },
];

export const STORE_COUPON_CODE_MAX = 40;

/** A coupon never takes an order below this: card processors do not charge less ($10 MXN). */
export const STORE_MIN_ORDER_TOTAL_CENTS = 1000;

/** Coupon codes one IP may try on the cart in ten minutes (against guessing codes). */
export const STORE_COUPON_ATTEMPTS = { limit: 20, windowMs: 10 * 60 * 1000 } as const;
