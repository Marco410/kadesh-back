import type { KeystoneContext } from "@keystone-6/core/types";
import { STORE_RESERVED_SLUGS } from "../../models/Pet/Store/constants";

const SLUG_MAX = 70;

/** Lowercase, no accents, emojis or symbols: "Cama para Perro (Grande)" → "cama-para-perro-grande". */
export function slugifyStore(value: string | null | undefined): string {
  const cleaned = (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, SLUG_MAX).replace(/-+$/g, "");
}

type SlugModel = "storeProduct" | "storeCategory" | "storeBrand";

const FALLBACK: Record<SlugModel, string> = {
  storeProduct: "producto",
  storeCategory: "categoria",
  storeBrand: "marca",
};

/** A free slug for `model`: the base, or the base with -2, -3… */
export async function uniqueStoreSlug(
  context: KeystoneContext,
  model: SlugModel,
  value: string | null | undefined,
  exceptId?: string,
): Promise<string> {
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  let base = slugifyStore(value) || FALLBACK[model];
  if (model === "storeProduct" && STORE_RESERVED_SLUGS.has(base)) base = `${FALLBACK[model]}-${base}`;
  for (let n = 1; n < 50; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const found = await prisma[model].findFirst({ where: { slug: candidate }, select: { id: true } });
    if (found instanceof Error) throw found;
    if (!found || found.id === exceptId) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Slug handling shared by the store lists, for `resolveInput`: on create it comes from the given
 * slug or from the name; on update it only changes when a new one is sent.
 */
export async function resolveStoreSlug(
  context: KeystoneContext,
  model: SlugModel,
  args: { operation: string; resolvedData: Record<string, any>; item?: Record<string, any> | null },
): Promise<string | undefined> {
  const { operation, resolvedData, item } = args;
  const given = typeof resolvedData.slug === "string" ? resolvedData.slug.trim() : "";
  if (operation === "create") {
    return uniqueStoreSlug(context, model, given || resolvedData.name);
  }
  if (!given) return undefined;
  const slug = slugifyStore(given);
  if (!slug || slug === item?.slug) return undefined;
  return uniqueStoreSlug(context, model, slug, item?.id ? String(item.id) : undefined);
}
