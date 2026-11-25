/**
 * «Dame una patita»: one-time donations to Kadesh Pet. The unit is a «patita» (not to be confused
 * with huellitas, the reward points of `models/Pet/Paws`). See README.md.
 */

/** Price of one patita, in MXN cents. The front has the same value (`DONATION_UNIT_PRICE_CENTS`). */
export const DONATION_UNIT_PRICE_CENTS = 2500;
/** Up to 400 patitas ($10,000 MXN) per donation. */
export const DONATION_MAX_UNITS = 400;
export const DONATION_NAME_MAX = 60;
export const DONATION_MESSAGE_MAX = 280;
export const DONATION_SOURCE_REF_MAX = 120;
export const DONATION_STATEMENT_DESCRIPTOR_SUFFIX = "DONATIVO";
/** `metadata.kind` of the PaymentIntent, read by the Stripe webhook. */
export const DONATION_PAYMENT_KIND = "donation";
/** A retry with the same checkout key answers the same intent for this long. */
export const DONATION_REPLAY_MS = 15 * 60 * 1000;

/** Public wall, ranking and summary: in memory 10 min, or until a donation is paid or refunded. */
export const DONATION_CACHE_MS = 10 * 60 * 1000;
export const DONATION_WALL_MAX_TAKE = 20;
export const DONATION_RANKING_MAX_TAKE = 10;

export const DONATION_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;

export const DONATION_STATUS_OPTIONS = [
  { label: "Pendiente", value: DONATION_STATUS.PENDING },
  { label: "Pagada", value: DONATION_STATUS.PAID },
  { label: "Falló", value: DONATION_STATUS.FAILED },
  { label: "Reembolsada", value: DONATION_STATUS.REFUNDED },
];

/** Where the donation form was opened from. Unknown values are saved as `other`. */
export const DONATION_SOURCES = [
  "header",
  "animal",
  "veterinary",
  "blog",
  "blog_post",
  "home",
  "donations_page",
  "reunited",
  "event",
  "profile",
  "footer",
  "about",
  "contact",
  "other",
] as const;

export const DONATION_SOURCE_OPTIONS = DONATION_SOURCES.map((value) => ({ label: value, value }));
