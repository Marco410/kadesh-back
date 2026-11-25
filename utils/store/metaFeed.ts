import type { KeystoneContext } from "@keystone-6/core/types";
import {
  STORE_CURRENCY,
  STORE_INVENTORY_POLICY,
  STORE_PRODUCT_SOURCE,
  STORE_PRODUCT_STATUS,
} from "../../models/Pet/Store/constants";
import { ANIMAL_TYPE_OPTIONS } from "../constants/constants";
import { storePrisma } from "./catalog";

/**
 * Product feed of the Kadesh Pet store for a Meta catalog (Commerce Manager, scheduled source).
 * Served by `feeds/metaCatalogFeed.ts` at `/feeds/meta/kadesh-pet.csv`.
 *
 * Only active products sold by Kadesh (own and Dropi). Mercado Libre affiliate products are left
 * out: they are not bought on our site. One row per variant on sale (active, price > 0).
 *
 * Privacy: the feed never carries the source, cost, supplier ids, SKUs or the word "Dropi", and
 * supplier boilerplate (free content notices, WhatsApp group links) is stripped from descriptions.
 */

export const META_FEED_PATH = "/feeds/meta/kadesh-pet.csv";
/** Stable image URLs: `/media/store/<StoreProductImage.id>` redirects to a fresh signed URL. */
export const STORE_MEDIA_PATH = "/media/store";

export const META_FEED_COLUMNS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "product_type",
  "quantity_to_sell_on_facebook",
  "custom_label_0",
  "custom_label_1",
  // Product id: Meta groups the variants of one product into a single listing.
  "item_group_id",
] as const;

export type MetaFeedColumn = (typeof META_FEED_COLUMNS)[number];
export type MetaFeedRow = Record<MetaFeedColumn, string>;

export const META_FEED_TITLE_MAX = 150;
export const META_FEED_DESCRIPTION_MAX = 5000;
export const META_FEED_ADDITIONAL_IMAGES_MAX = 10;
/** Products read per build. Far above the catalog today; a log line says when it is reached. */
export const META_FEED_MAX_PRODUCTS = 5000;
/** The CSV is kept in memory this long (and rebuilt sooner after a catalog edit). */
export const META_FEED_CACHE_MS = 15 * 60 * 1000;
export const META_FEED_DEFAULT_BRAND = "Kadesh Pet";
export const META_FEED_STORE_URL = "https://pet.kadesh.com.mx/tienda";
export const META_FEED_UTM = "utm_source=facebook&utm_medium=catalogo&utm_campaign=tienda";

const ANIMAL_LABELS = new Map(ANIMAL_TYPE_OPTIONS.map((option) => [option.value as string, option.label]));

/** What the feed reads of a product. `source` is only used to filter; it is never written out. */
export type MetaFeedProduct = {
  id: string;
  slug: string | null;
  name: string;
  shortDescription: string | null;
  description: string | null;
  status: string;
  source: string;
  isFeatured: boolean | null;
  inventoryPolicy: string | null;
  category: { name: string; parent: { name: string } | null } | null;
  brand: { name: string } | null;
  animalTypes: Array<{ name: string | null }>;
  variants: Array<{
    id: string;
    title: string | null;
    priceCents: number | null;
    compareAtPriceCents: number | null;
    stock: number | null;
    isActive?: boolean | null;
  }>;
  /** Size of the uploaded original; null for external photos (unknown, let through). */
  images: Array<{ id: string; width?: number | null; height?: number | null }>;
};

/** `no_valid_image`: no photo at all, or none of at least 500×500. */
export type MetaFeedSkip = { productId: string; reason: "no_variant_on_sale" | "no_valid_image" };

// ─── Text cleanup ────────────────────────────────────────────────────────────────────────────

/** Lines a supplier pastes into descriptions: free-content notices, group invites, outbound links. */
const SUPPLIER_LINE =
  /(contenido\s+gratuito|chat\.whatsapp\.com|wa\.me\/|whats\s?app|telegram|t\.me\/|\bdropi\b|proveedor|\bgrupo\b.*\b(vip|whats|telegram|facebook|difusi[oó]n)|https?:\/\/|www\.)/i;

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/gu;
// Control characters except tab and line breaks (handled separately).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B\u2028\u2029]/g;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
  uuml: "ü",
  iexcl: "¡",
  iquest: "¿",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[code] ?? match;
  });
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.8 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Plain one-line text: no HTML, emojis, control characters or the supplier's name. */
export function cleanInlineText(value: string | null | undefined): string {
  return decodeEntities(String(value ?? "").replace(/<[^>]*>/g, " "))
    .replace(EMOJI, "")
    .replace(CONTROL, " ")
    .replace(/\bdropi\b/gi, "")
    .replace(/\s+/g, " ")
    // A removed inline tag («<b>mano</b>.») leaves a space before the punctuation.
    .replace(/\s+([.,;:!?)])/g, "$1")
    .trim();
}

/**
 * Long description as plain text for Meta: HTML out, supplier lines dropped, line breaks turned
 * into spaces, at most `META_FEED_DESCRIPTION_MAX` characters.
 */
export function cleanDescription(value: string | null | undefined): string {
  const withBreaks = String(value ?? "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ");
  const lines = decodeEntities(withBreaks)
    .split(/\r\n|\r|\n/)
    .filter((line) => !SUPPLIER_LINE.test(line))
    .map((line) => cleanInlineText(line).replace(/^[-•*·▪►✔✓]+\s*/, ""))
    .filter(Boolean);
  return truncate(lines.join(" ").replace(/\s+/g, " ").trim(), META_FEED_DESCRIPTION_MAX);
}

// ─── Columns ────────────────────────────────────────────────────────────────────────────────

export function formatFeedPrice(cents: number): string {
  return `${(Math.max(0, Math.round(cents)) / 100).toFixed(2)} ${STORE_CURRENCY}`;
}

/**
 * `price` is what Meta shows crossed out when `sale_price` is set: the previous price when it is
 * higher than the current one, else the current price with `sale_price` empty.
 */
export function feedPrices(priceCents: number | null, compareAtPriceCents: number | null): {
  price: string;
  sale_price: string;
} {
  const price = Number(priceCents) || 0;
  const compare = Number(compareAtPriceCents) || 0;
  if (compare > price) return { price: formatFeedPrice(compare), sale_price: formatFeedPrice(price) };
  return { price: formatFeedPrice(price), sale_price: "" };
}

export function feedAvailability(
  inventoryPolicy: string | null,
  variant: { stock: number | null; isActive?: boolean | null },
): "in stock" | "out of stock" | "available for order" {
  if (variant.isActive === false) return "available for order";
  if (inventoryPolicy === STORE_INVENTORY_POLICY.UNTRACKED) return "available for order";
  return (Number(variant.stock) || 0) > 0 ? "in stock" : "out of stock";
}

export function feedProductLink(product: { slug: string | null; id: string }): string {
  return `${META_FEED_STORE_URL}/${encodeURIComponent(product.slug || product.id)}?${META_FEED_UTM}`;
}

/** Meta rejects smaller photos: the feed leaves them out. */
export const META_FEED_IMAGE_MIN_PX = 500;

/** Size check for the feed. Unknown size (external photos) is let through. */
export function isFeedImageLargeEnough(width: number | null | undefined, height: number | null | undefined): boolean {
  if (width == null || height == null) return true;
  return width >= META_FEED_IMAGE_MIN_PX && height >= META_FEED_IMAGE_MIN_PX;
}

/** JPEG copy of a store photo, served by `feeds/metaCatalogFeed.ts`. */
export function storeMediaUrl(baseUrl: string, imageId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${STORE_MEDIA_PATH}/${encodeURIComponent(imageId)}.jpg`;
}

function productType(category: MetaFeedProduct["category"]): string {
  if (!category) return "";
  const names = [category.parent?.name, category.name].map(cleanInlineText).filter(Boolean);
  return names.join(" > ");
}

function animalLabels(animalTypes: MetaFeedProduct["animalTypes"]): string {
  const labels = animalTypes
    .map((type) => (type.name ? ANIMAL_LABELS.get(type.name) ?? type.name : ""))
    .filter(Boolean);
  return Array.from(new Set(labels)).join(",");
}

/** Products that belong in the feed: active and sold on our site. */
export function isMetaFeedProduct(product: { status: string; source: string }): boolean {
  return (
    product.status === STORE_PRODUCT_STATUS.ACTIVE &&
    (product.source === STORE_PRODUCT_SOURCE.OWN || product.source === STORE_PRODUCT_SOURCE.DROPI)
  );
}

/** Rows of the feed, plus the products left out and why. Pure: no database, no clock. */
export function buildMetaFeedRows(
  products: MetaFeedProduct[],
  options: { mediaBaseUrl: string },
): { rows: MetaFeedRow[]; skipped: MetaFeedSkip[]; smallImages: number } {
  const rows: MetaFeedRow[] = [];
  const skipped: MetaFeedSkip[] = [];
  /** Photos left out for being under 500×500, in products that made it into the feed or not. */
  let smallImages = 0;

  for (const product of products) {
    if (!isMetaFeedProduct(product)) continue;
    const variants = product.variants.filter(
      (variant) => variant.isActive !== false && (Number(variant.priceCents) || 0) > 0,
    );
    if (variants.length === 0) {
      skipped.push({ productId: product.id, reason: "no_variant_on_sale" });
      continue;
    }
    // A small cover gives way to the next photo that is large enough.
    const images = product.images.filter((image) => isFeedImageLargeEnough(image.width, image.height));
    smallImages += product.images.length - images.length;
    if (images.length === 0) {
      skipped.push({ productId: product.id, reason: "no_valid_image" });
      continue;
    }

    const name = cleanInlineText(product.name);
    const description = cleanDescription(product.description) || cleanDescription(product.shortDescription) || name;
    const [cover, ...rest] = images;
    const shared = {
      description,
      condition: "new",
      link: feedProductLink(product),
      image_link: storeMediaUrl(options.mediaBaseUrl, cover.id),
      additional_image_link: rest
        .slice(0, META_FEED_ADDITIONAL_IMAGES_MAX)
        .map((image) => storeMediaUrl(options.mediaBaseUrl, image.id))
        .join(","),
      brand: cleanInlineText(product.brand?.name) || META_FEED_DEFAULT_BRAND,
      product_type: productType(product.category),
      custom_label_0: product.isFeatured ? "destacado" : "",
      custom_label_1: animalLabels(product.animalTypes),
      item_group_id: product.id,
    };

    for (const variant of variants) {
      const variantTitle = cleanInlineText(variant.title);
      const tracked = product.inventoryPolicy !== STORE_INVENTORY_POLICY.UNTRACKED;
      rows.push({
        id: variant.id,
        title: truncate(variantTitle ? `${name} - ${variantTitle}` : name, META_FEED_TITLE_MAX),
        ...feedPrices(variant.priceCents, variant.compareAtPriceCents),
        availability: feedAvailability(product.inventoryPolicy, variant),
        quantity_to_sell_on_facebook: tracked ? String(Math.max(0, Number(variant.stock) || 0)) : "",
        ...shared,
      });
    }
  }
  return { rows, skipped, smallImages };
}

// ─── CSV ────────────────────────────────────────────────────────────────────────────────────

/** RFC 4180 field: quoted when it has a quote, comma or line break; `force` always quotes. */
export function csvField(value: string, force = false): string {
  const text = String(value ?? "");
  if (force || /[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toMetaFeedCsv(rows: MetaFeedRow[]): string {
  const lines = [META_FEED_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      META_FEED_COLUMNS.map((column) =>
        csvField(row[column], column === "additional_image_link" && row[column] !== ""),
      ).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

// ─── Database ───────────────────────────────────────────────────────────────────────────────

type ImageRow = { id: string; image_width: number | null; image_height: number | null };

/**
 * Every product of the feed in one Prisma call (Prisma batches each relation with `IN`: about seven
 * SQL statements whatever the number of products). Selects nothing internal beyond `source`.
 */
export async function loadMetaFeedProducts(context: KeystoneContext): Promise<MetaFeedProduct[]> {
  const result = await storePrisma(context).storeProduct.findMany({
    where: {
      status: STORE_PRODUCT_STATUS.ACTIVE,
      source: { in: [STORE_PRODUCT_SOURCE.OWN, STORE_PRODUCT_SOURCE.DROPI] },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: META_FEED_MAX_PRODUCTS,
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      description: true,
      status: true,
      source: true,
      isFeatured: true,
      inventoryPolicy: true,
      category: { select: { name: true, parent: { select: { name: true } } } },
      brand: { select: { name: true } },
      animalTypes: { select: { name: true } },
      variants: {
        where: { isActive: true, priceCents: { gt: 0 } },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, priceCents: true, compareAtPriceCents: true, stock: true, isActive: true },
      },
      images: {
        where: { OR: [{ image_id: { not: null } }, { externalUrl: { not: null } }] },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true, image_width: true, image_height: true },
      },
    },
  });
  if (result instanceof Error) throw result;
  const products = (result as Array<Omit<MetaFeedProduct, "images"> & { images: ImageRow[] }>).map((product) => ({
    ...product,
    images: product.images.map((image) => ({ id: image.id, width: image.image_width, height: image.image_height })),
  }));
  if (products.length >= META_FEED_MAX_PRODUCTS) {
    console.warn(`[meta feed] reached ${META_FEED_MAX_PRODUCTS} products: raise META_FEED_MAX_PRODUCTS`);
  }
  return products;
}
