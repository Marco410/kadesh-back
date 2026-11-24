/**
 * Kadesh Pet ads. See ./README.md.
 *
 * The front (kadesh-landing, kadesh-pet-mobile, Operaciones in kadesh-business) keeps a copy of the
 * placement and kind values: change them here first, then there.
 */

export const AD_KIND = {
  /** Kadesh's own products (Business, Food…). Fills the slot when nothing paid applies. */
  HOUSE: "house",
  /** A product of the Kadesh Pet store. */
  STORE_PRODUCT: "store_product",
  /** A clinic, groomer or pet shop listed in Kadesh Pet. */
  PET_PLACE: "pet_place",
  /** An animal for adoption or a lost-pet report. */
  ANIMAL: "animal",
  /** An outside brand, product or service, with a link to its site. */
  BRAND: "brand",
} as const;
export type AdKind = (typeof AD_KIND)[keyof typeof AD_KIND];

export const AD_KIND_OPTIONS = [
  { label: "Kadesh (de la casa)", value: AD_KIND.HOUSE },
  { label: "Producto de la tienda", value: AD_KIND.STORE_PRODUCT },
  { label: "Veterinaria o negocio", value: AD_KIND.PET_PLACE },
  { label: "Animal", value: AD_KIND.ANIMAL },
  { label: "Marca o servicio externo", value: AD_KIND.BRAND },
];

export const AD_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  PAUSED: "paused",
  ENDED: "ended",
} as const;
export type AdStatus = (typeof AD_STATUS)[keyof typeof AD_STATUS];

export const AD_STATUS_OPTIONS = [
  { label: "Borrador", value: AD_STATUS.DRAFT },
  { label: "Activo", value: AD_STATUS.ACTIVE },
  { label: "Pausado", value: AD_STATUS.PAUSED },
  { label: "Terminado", value: AD_STATUS.ENDED },
];

/**
 * Where an ad can show. Operaciones picks them per ad. A new screen that shows ads adds a value
 * here and it shows up as one more checkbox in the editor.
 */
export const AD_PLACEMENT = {
  ANIMAL_DETAIL: "animal_detail",
  VET_DETAIL: "vet_detail",
  BLOG: "blog",
  STORE: "store",
} as const;
export type AdPlacement = (typeof AD_PLACEMENT)[keyof typeof AD_PLACEMENT];
export const AD_PLACEMENTS: readonly AdPlacement[] = Object.values(AD_PLACEMENT);

export const AD_PLACEMENT_OPTIONS = [
  { label: "Detalle de animal", value: AD_PLACEMENT.ANIMAL_DETAIL },
  { label: "Detalle de veterinaria", value: AD_PLACEMENT.VET_DETAIL },
  { label: "Blog", value: AD_PLACEMENT.BLOG },
  { label: "Tienda", value: AD_PLACEMENT.STORE },
];

/**
 * Only a suggestion: the editor ticks these when the kind is picked and warns (without blocking)
 * when the admin picks something else. The admin has the last word.
 */
export const AD_SUGGESTED_PLACEMENTS_BY_KIND: Record<AdKind, AdPlacement[]> = {
  [AD_KIND.HOUSE]: [...AD_PLACEMENTS],
  [AD_KIND.STORE_PRODUCT]: [...AD_PLACEMENTS],
  // On a clinic's page another clinic would be its competition.
  [AD_KIND.PET_PLACE]: [AD_PLACEMENT.ANIMAL_DETAIL, AD_PLACEMENT.BLOG, AD_PLACEMENT.STORE],
  [AD_KIND.ANIMAL]: [AD_PLACEMENT.ANIMAL_DETAIL, AD_PLACEMENT.VET_DETAIL, AD_PLACEMENT.BLOG],
  [AD_KIND.BRAND]: [...AD_PLACEMENTS],
};

/**
 * Color of the card: one of these names, or a custom color as `#rrggbb` (`AD_CUSTOM_TONE_RE`).
 * The fronts map each name to their own classes (light and dark) and derive the shades of a
 * custom color. Orange is Kadesh Business, green Kadesh Food, sky Kadesh Pet (#216BFA).
 */
export const AD_TONE = {
  ORANGE: "orange",
  GREEN: "green",
  SKY: "sky",
  VIOLET: "violet",
  NEUTRAL: "neutral",
} as const;

export const AD_TONE_OPTIONS = [
  { label: "Naranja", value: AD_TONE.ORANGE },
  { label: "Verde", value: AD_TONE.GREEN },
  { label: "Azul", value: AD_TONE.SKY },
  { label: "Morado", value: AD_TONE.VIOLET },
  { label: "Neutro", value: AD_TONE.NEUTRAL },
];

/** A custom card color: `#` and six hex digits (stored in lowercase). */
export const AD_CUSTOM_TONE_RE = /^#[0-9a-f]{6}$/;

export function isAdTone(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return AD_TONE_OPTIONS.some((option) => option.value === value) || AD_CUSTOM_TONE_RE.test(value);
}

export const AD_GEO_SCOPE = {
  NATIONAL: "national",
  RADIUS: "radius",
} as const;
export type AdGeoScope = (typeof AD_GEO_SCOPE)[keyof typeof AD_GEO_SCOPE];

export const AD_GEO_SCOPE_OPTIONS = [
  { label: "Todo el país", value: AD_GEO_SCOPE.NATIONAL },
  { label: "Una zona (radio)", value: AD_GEO_SCOPE.RADIUS },
];

export const AD_RADIUS_KM = { MIN: 1, MAX: 300 } as const;
export const AD_WEIGHT = { MIN: 1, MAX: 10 } as const;

export const AD_PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  /** Free: house ads, partners, promos. */
  WAIVED: "waived",
} as const;

export const AD_PAYMENT_STATUS_OPTIONS = [
  { label: "Pendiente", value: AD_PAYMENT_STATUS.PENDING },
  { label: "Pagado", value: AD_PAYMENT_STATUS.PAID },
  { label: "Sin costo", value: AD_PAYMENT_STATUS.WAIVED },
];

export const AD_PAYMENT_METHOD_OPTIONS = [
  { label: "Transferencia", value: "transfer" },
  { label: "Efectivo", value: "cash" },
  { label: "Liga de pago (Stripe)", value: "stripe_link" },
  { label: "Otro", value: "other" },
];

/** Longest texts that still fit the card (316 px slot on the web, full width on the app). */
export const AD_TEXT_LIMITS = {
  title: 70,
  body: 160,
  brandLabel: 24,
  ctaLabel: 20,
} as const;

/** `activeAds` keeps the list in memory this long (and is cleared when an ad is saved). */
export const ACTIVE_ADS_CACHE_MS = 5 * 60 * 1000;
/** Most ads the public list carries. */
export const ACTIVE_ADS_MAX = 100;

/** The same person counts again for the same ad, placement and event after this long. */
export const AD_EVENT_DEDUPE_MS = 30 * 60 * 1000;
/** Most events in one `recordAdEvents` call. */
export const AD_EVENTS_MAX_BATCH = 50;
/** `recordAdEvents` calls per IP: a tab sends one every 10 s at most. */
export const AD_EVENTS_RATE = { limit: 30, windowMs: 5 * 60 * 1000 } as const;

/** Periods of the Operaciones report and how long each one is cached. */
export const AD_STATS_DAYS = [7, 30, 90] as const;
export const AD_STATS_CACHE_MS = 5 * 60 * 1000;
/** Rows per page of the Operaciones list. */
export const ADMIN_ADS_MAX_TAKE = 100;
/** Rows of the target picker (animal, product, clinic). */
export const AD_TARGET_SEARCH_TAKE = 20;
