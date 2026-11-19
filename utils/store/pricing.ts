import type { KeystoneContext } from "@keystone-6/core/types";
import {
  STORE_CART_MAX_LINES,
  STORE_CART_MAX_QUANTITY,
  STORE_CURRENCY,
  STORE_INVENTORY_POLICY,
  STORE_PAYMENT_METHOD,
  STORE_PRODUCT_SOURCE,
  STORE_PRODUCT_STATUS,
} from "../../models/Pet/Store/constants";
import { loadStoreCovers, storePrisma } from "./catalog";
import { getStoreSettings, isCardAvailable, isTransferAvailable, type StoreSettingsValue } from "./settings";

/**
 * What a cart costs, computed on the server. The browser only sends variants and quantities:
 * prices, stock, shipping and totals come from here, both for the cart preview (`storeCartQuote`)
 * and for placing the order (`placeStoreOrder`), so the two can never disagree.
 */

export type CartItemInput = { variantId: string; quantity: number };

/** Why a line cannot be bought as asked. */
export const CART_ISSUE = {
  /** Product or variant gone, paused, or only sold on Mercado Libre. */
  UNAVAILABLE: "unavailable",
  OUT_OF_STOCK: "out_of_stock",
  /** There is stock, but less than asked: `quantity` was lowered. */
  QUANTITY_REDUCED: "quantity_reduced",
} as const;

export type CartLine = {
  variantId: string;
  productId: string | null;
  slug: string | null;
  name: string;
  variantTitle: string | null;
  coverUrl: string | null;
  unitPriceCents: number;
  compareAtPriceCents: number | null;
  /** What can actually be bought (0 when unavailable). */
  quantity: number;
  requestedQuantity: number;
  lineTotalCents: number;
  /** Most units one order may carry of this line. */
  maxQuantity: number;
  issue: string | null;
  // Internal: never returned to the shopper.
  source: string;
  sku: string | null;
  tracked: boolean;
  unitCostCents: number | null;
  externalId: string | null;
  dropiVariationId: number | null;
  dropiSupplierId: number | null;
};

export type CartQuote = {
  lines: CartLine[];
  itemsCount: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  costCents: number;
  currency: string;
  /** 0 = shipping is never free. */
  freeShippingMinCents: number;
  /** How much more to add for free shipping; 0 when already free or never free. */
  missingForFreeShippingCents: number;
  /** Every line can be bought exactly as asked. */
  canCheckout: boolean;
  messages: string[];
  paymentMethods: string[];
  returnPolicy: string;
  settings: StoreSettingsValue;
};

type VariantRow = {
  id: string;
  title: string | null;
  sku: string | null;
  priceCents: number | null;
  compareAtPriceCents: number | null;
  costCents: number | null;
  stock: number | null;
  isActive: boolean | null;
  dropiVariationId: number | null;
  product: {
    id: string;
    slug: string | null;
    name: string;
    source: string;
    status: string;
    inventoryPolicy: string | null;
    externalId: string | null;
    dropiSupplierId: number | null;
  } | null;
};

/** One entry per variant, quantities added up and clamped to whole numbers ≥ 1. */
export function normalizeCartItems(items: CartItemInput[] | null | undefined): CartItemInput[] {
  const byVariant = new Map<string, number>();
  for (const item of items ?? []) {
    const variantId = typeof item?.variantId === "string" ? item.variantId.trim() : "";
    const quantity = Math.floor(Number(item?.quantity));
    if (!variantId || !Number.isFinite(quantity) || quantity < 1) continue;
    byVariant.set(variantId, (byVariant.get(variantId) ?? 0) + quantity);
  }
  return [...byVariant.entries()].slice(0, STORE_CART_MAX_LINES).map(([variantId, quantity]) => ({ variantId, quantity }));
}

export function shippingFor(subtotalCents: number, settings: StoreSettingsValue): number {
  if (subtotalCents <= 0) return 0;
  if (settings.freeShippingMinCents > 0 && subtotalCents >= settings.freeShippingMinCents) return 0;
  return settings.shippingFlatCents;
}

/** Quote of a cart: three queries (variants with their product, covers, settings from memory). */
export async function quoteCart(context: KeystoneContext, rawItems: CartItemInput[] | null | undefined): Promise<CartQuote> {
  const settings = await getStoreSettings(context);
  const items = normalizeCartItems(rawItems);
  const prisma = storePrisma(context);

  const rows = items.length
    ? await prisma.storeProductVariant.findMany({
        where: { id: { in: items.map((item) => item.variantId) } },
        select: {
          id: true,
          title: true,
          sku: true,
          priceCents: true,
          compareAtPriceCents: true,
          costCents: true,
          stock: true,
          isActive: true,
          dropiVariationId: true,
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              source: true,
              status: true,
              inventoryPolicy: true,
              externalId: true,
              dropiSupplierId: true,
            },
          },
        },
      })
    : [];
  if (rows instanceof Error) throw rows;
  const variants = new Map((rows as VariantRow[]).map((row) => [row.id, row]));
  const covers = await loadStoreCovers(
    context,
    [...new Set((rows as VariantRow[]).map((row) => row.product?.id).filter((id): id is string => Boolean(id)))],
  );

  const messages: string[] = [];
  const lines: CartLine[] = items.map((item) => {
    const variant = variants.get(item.variantId);
    const product = variant?.product ?? null;
    const price = Number(variant?.priceCents) || 0;
    const sellable =
      Boolean(variant && product) &&
      variant!.isActive !== false &&
      product!.status === STORE_PRODUCT_STATUS.ACTIVE &&
      product!.source !== STORE_PRODUCT_SOURCE.MERCADO_LIBRE &&
      price > 0;
    const tracked = product?.inventoryPolicy === STORE_INVENTORY_POLICY.TRACKED;
    const stock = Math.max(0, Number(variant?.stock) || 0);
    const maxQuantity = sellable ? (tracked ? Math.min(stock, STORE_CART_MAX_QUANTITY) : STORE_CART_MAX_QUANTITY) : 0;
    const quantity = Math.min(item.quantity, maxQuantity);
    const name = product?.name ?? "Producto no disponible";

    let issue: string | null = null;
    if (!sellable) {
      issue = CART_ISSUE.UNAVAILABLE;
      messages.push(`«${name}» ya no está disponible.`);
    } else if (maxQuantity === 0) {
      issue = CART_ISSUE.OUT_OF_STOCK;
      messages.push(`«${name}» se agotó.`);
    } else if (quantity < item.quantity) {
      issue = CART_ISSUE.QUANTITY_REDUCED;
      messages.push(
        tracked && stock < STORE_CART_MAX_QUANTITY
          ? `De «${name}» solo ${quantity === 1 ? "queda 1" : `quedan ${quantity}`}.`
          : `De «${name}» puedes llevar hasta ${maxQuantity} por pedido.`,
      );
    }

    const compare = Number(variant?.compareAtPriceCents) || 0;
    return {
      variantId: item.variantId,
      productId: product?.id ?? null,
      slug: product?.slug ?? null,
      name,
      variantTitle: variant?.title || null,
      coverUrl: product ? covers.get(product.id)?.url ?? null : null,
      unitPriceCents: sellable ? price : 0,
      compareAtPriceCents: sellable && compare > price ? compare : null,
      quantity,
      requestedQuantity: item.quantity,
      lineTotalCents: sellable ? price * quantity : 0,
      maxQuantity,
      issue,
      source: product?.source ?? "",
      sku: variant?.sku || null,
      tracked,
      unitCostCents: variant?.costCents ?? null,
      externalId: product?.externalId ?? null,
      dropiVariationId: variant?.dropiVariationId ?? null,
      dropiSupplierId: product?.dropiSupplierId ?? null,
    };
  });

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const shippingCents = shippingFor(subtotalCents, settings);
  const paymentMethods = [
    ...(isCardAvailable(settings) ? [STORE_PAYMENT_METHOD.CARD] : []),
    ...(isTransferAvailable(settings) ? [STORE_PAYMENT_METHOD.TRANSFER] : []),
  ];
  const free = settings.freeShippingMinCents;

  return {
    lines,
    itemsCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    costCents: lines.reduce((sum, line) => sum + (Number(line.unitCostCents) || 0) * line.quantity, 0),
    currency: STORE_CURRENCY,
    freeShippingMinCents: free,
    missingForFreeShippingCents: free > 0 && subtotalCents > 0 && subtotalCents < free ? free - subtotalCents : 0,
    canCheckout: lines.length > 0 && lines.every((line) => !line.issue) && subtotalCents > 0,
    messages,
    paymentMethods,
    returnPolicy: settings.returnPolicy,
    settings,
  };
}

/** The part of a quote a shopper may see: no source, cost, supplier or settings. */
export function publicQuote(quote: CartQuote) {
  return {
    lines: quote.lines.map((line) => ({
      variantId: line.variantId,
      productId: line.productId,
      slug: line.slug,
      name: line.name,
      variantTitle: line.variantTitle,
      coverUrl: line.coverUrl,
      unitPriceCents: line.unitPriceCents,
      compareAtPriceCents: line.compareAtPriceCents,
      quantity: line.quantity,
      requestedQuantity: line.requestedQuantity,
      lineTotalCents: line.lineTotalCents,
      maxQuantity: line.maxQuantity,
      issue: line.issue,
    })),
    itemsCount: quote.itemsCount,
    subtotalCents: quote.subtotalCents,
    shippingCents: quote.shippingCents,
    totalCents: quote.totalCents,
    currency: quote.currency,
    freeShippingMinCents: quote.freeShippingMinCents,
    missingForFreeShippingCents: quote.missingForFreeShippingCents,
    canCheckout: quote.canCheckout,
    messages: quote.messages,
    paymentMethods: quote.paymentMethods,
    returnPolicy: quote.returnPolicy,
  };
}

export const CART_QUOTE_TYPEDEFS = `
  input StoreCartItemInput {
    variantId: ID!
    quantity: Int!
  }

  type StoreCartLine {
    variantId: ID!
    productId: ID
    slug: String
    name: String!
    variantTitle: String
    coverUrl: String
    "MXN cents. 0 when the line cannot be bought."
    unitPriceCents: Int!
    compareAtPriceCents: Int
    "What can actually be bought; lower than requestedQuantity when stock is short."
    quantity: Int!
    requestedQuantity: Int!
    lineTotalCents: Int!
    maxQuantity: Int!
    "null | unavailable | out_of_stock | quantity_reduced"
    issue: String
  }

  type StoreCartQuote {
    lines: [StoreCartLine!]!
    itemsCount: Int!
    subtotalCents: Int!
    shippingCents: Int!
    totalCents: Int!
    currency: String!
    "0 = shipping is never free."
    freeShippingMinCents: Int!
    missingForFreeShippingCents: Int!
    "Every line can be bought exactly as asked."
    canCheckout: Boolean!
    "One sentence per problem, ready to show."
    messages: [String!]!
    "stripe_card and/or bank_transfer"
    paymentMethods: [String!]!
    returnPolicy: String!
  }
`;
