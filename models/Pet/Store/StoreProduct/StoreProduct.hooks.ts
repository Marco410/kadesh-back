import type { KeystoneContext } from "@keystone-6/core/types";
import { normalizeSearchText } from "../../../../utils/helpers/normalizeSearchText";
import { isHttpsUrl, recomputeStoreProductTotals, storePrisma } from "../../../../utils/store/catalog";
import { bumpStoreCatalogVersion } from "../../../../utils/store/config";
import { resolveStoreSlug } from "../../../../utils/store/slug";
import { STORE_PRODUCT_SOURCE, STORE_PRODUCT_STATUS } from "../constants";

type HookArgs = {
  operation: string;
  resolvedData: Record<string, any>;
  item?: Record<string, any> | null;
  originalItem?: Record<string, any> | null;
  inputData?: Record<string, any> | null;
  context: KeystoneContext;
  addValidationError: (message: string) => void;
};

/**
 * Stored copies that only the server computes (from variants and reviews). A value sent through
 * the API is dropped; they are written with prisma directly, which skips these hooks.
 */
const DERIVED_FIELDS = [
  "nameSearch",
  "priceCents",
  "compareAtPriceCents",
  "stockTotal",
  "ratingAverage",
  "ratingCount",
  "salesCount",
] as const;

const NULL_WHEN_EMPTY = ["externalId", "externalUrl", "affiliateUrl"] as const;

export async function storeProductResolveInput({ resolvedData, item, operation, context }: HookArgs) {
  const data = { ...resolvedData };
  for (const field of DERIVED_FIELDS) delete data[field];

  // `resolvedData` carries every key; the ones not in this change are `undefined`.
  if (typeof data.name === "string") data.nameSearch = normalizeSearchText(data.name);

  const slug = await resolveStoreSlug(context, "storeProduct", { operation, resolvedData: data, item });
  if (slug !== undefined) data.slug = slug;
  else delete data.slug;

  // An empty text would collide on the unique (source, externalId): several nulls are allowed.
  for (const field of NULL_WHEN_EMPTY) {
    if (typeof data[field] === "string") data[field] = data[field].trim() || null;
  }

  if (data.status === STORE_PRODUCT_STATUS.ACTIVE && !item?.publishedAt && !data.publishedAt) {
    data.publishedAt = new Date();
  }
  return data;
}

export function storeProductValidateInput({ resolvedData, item, operation, addValidationError }: HookArgs) {
  if (operation === "delete") return;
  const pick = (field: string) => (resolvedData[field] !== undefined ? resolvedData[field] : item?.[field]);

  const source = pick("source");
  const affiliateUrl = pick("affiliateUrl");
  if (source === STORE_PRODUCT_SOURCE.MERCADO_LIBRE && !isHttpsUrl(affiliateUrl)) {
    addValidationError("Un producto de Mercado Libre necesita su enlace de afiliado (https://…).");
  }
  if (source !== STORE_PRODUCT_SOURCE.MERCADO_LIBRE && affiliateUrl) {
    addValidationError("El enlace de afiliado solo aplica a productos de Mercado Libre.");
  }
  const externalUrl = pick("externalUrl");
  if (externalUrl && !isHttpsUrl(externalUrl)) {
    addValidationError("El enlace externo debe empezar con https://.");
  }
  if (source === STORE_PRODUCT_SOURCE.DROPI && !pick("externalId")) {
    addValidationError("Un producto de Dropi necesita su id de Dropi (externalId).");
  }
}

/** A product with reviews is archived, not deleted: its reviews would be lost. */
export async function storeProductValidateDelete({ item, context, addValidationError }: HookArgs) {
  if (!item?.id) return;
  const reviews = await storePrisma(context).storeProductReview.count({ where: { productId: item.id } });
  if (reviews instanceof Error) throw reviews;
  if (Number(reviews) > 0) {
    addValidationError("Este producto tiene reseñas: archívalo en vez de borrarlo.");
  }
}

/** Deleting a product takes its variants, images (and their files) and wishlist rows with it. */
export async function storeProductBeforeOperation({ operation, item, context }: HookArgs) {
  if (operation !== "delete" || !item?.id) return;
  const sudo = context.sudo();
  const prisma = storePrisma(context);
  const images = await prisma.storeProductImage.findMany({ where: { productId: item.id }, select: { id: true } });
  if (images instanceof Error) throw images;
  if ((images as Array<{ id: string }>).length > 0) {
    // Through Keystone so the image field removes each file from storage.
    await sudo.db.StoreProductImage.deleteMany({
      where: (images as Array<{ id: string }>).map((image) => ({ id: image.id })),
    });
  }
  const variants = await prisma.storeProductVariant.deleteMany({ where: { productId: item.id } });
  if (variants instanceof Error) throw variants;
  const wishes = await prisma.storeWishlistItem.deleteMany({ where: { productId: item.id } });
  if (wishes instanceof Error) throw wishes;
}

export async function storeProductAfterOperation({ operation, item, inputData, context }: HookArgs) {
  bumpStoreCatalogVersion();
  if (operation === "delete" || !item?.id) return;
  // Variants created inline with the product are connected after their own hook ran: the totals
  // are computed here, once the product exists.
  if (operation === "create" || inputData?.variants !== undefined) {
    await recomputeStoreProductTotals(context, String(item.id), { priceTouched: true });
  }
}
