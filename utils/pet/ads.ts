import type { KeystoneContext } from "@keystone-6/core/types";
import {
  ACTIVE_ADS_CACHE_MS,
  ACTIVE_ADS_MAX,
  AD_GEO_SCOPE,
  AD_KIND,
  AD_STATUS,
  type AdKind,
} from "../../models/Pet/Ad/constants";
import { STORE_PRODUCT_STATUS } from "../../models/Pet/Store/constants";
import { loadStoreCovers } from "../store/catalog";
import { storeEnabled } from "../store/config";
import { mxToday } from "../usage/dailyUsageRollup";
import { getAnimalCoverUrls } from "./animalCovers";

/**
 * The ads the public sees, with everything the card needs. Kadesh Pet (web and app) downloads the
 * whole list once and picks per screen (placement, zone, rotation) on its side: showing an ad never
 * costs a query per visit. See models/Pet/Ad/README.md.
 */
export type PublicAd = {
  id: string;
  kind: AdKind;
  title: string;
  body: string;
  brandLabel: string;
  ctaLabel: string;
  /** orange | green | sky | violet | neutral */
  tone: string;
  imageUrl: string | null;
  /** A path of Kadesh Pet (`/animales/…`, `/tienda/…`, `/veterinarias/…`) or an outside https link. */
  href: string;
  placements: string[];
  weight: number;
  /** The animal, product or clinic it promotes, so that page does not show its own ad. */
  targetId: string | null;
  geoScope: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
};

type AdRow = {
  id: string;
  kind: AdKind;
  title: string;
  body: string;
  brandLabel: string;
  ctaLabel: string;
  tone: string;
  image_id: string | null;
  image_extension: string | null;
  url: string;
  placements: unknown;
  weight: number;
  geoScope: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
  storeProduct: { id: string; slug: string | null; status: string } | null;
  petPlace: { id: string; slug: string | null } | null;
  animal: { id: string; slug: string | null; duplicateOfId: string | null } | null;
};

let cache: { value: PublicAd[]; at: number } | null = null;
let pending: Promise<PublicAd[]> | null = null;
/** Goes up on every save: a load that started before it is not kept. */
let generation = 0;

/** Called when an ad is saved, so the change shows up without waiting for the cache. */
export function invalidateActiveAds(): void {
  cache = null;
  pending = null;
  generation += 1;
}

function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

/** Where the card leads, or null when the target is no longer public (hidden product, no slug…). */
function hrefOf(row: AdRow): string | null {
  switch (row.kind) {
    case AD_KIND.STORE_PRODUCT:
      if (!storeEnabled() || row.storeProduct?.status !== STORE_PRODUCT_STATUS.ACTIVE) return null;
      return row.storeProduct.slug ? `/tienda/${row.storeProduct.slug}` : null;
    case AD_KIND.PET_PLACE:
      return row.petPlace?.slug ? `/veterinarias/${row.petPlace.slug}` : null;
    case AD_KIND.ANIMAL:
      if (!row.animal?.slug || row.animal.duplicateOfId) return null;
      return `/animales/${row.animal.slug}`;
    default:
      return row.url || null;
  }
}

async function signAdImage(context: KeystoneContext, row: AdRow): Promise<string | null> {
  if (!row.image_id) return null;
  try {
    return await context.images("s3_ads").getUrl(row.image_id, (row.image_extension || "jpg") as any);
  } catch (error) {
    console.error("[ads] could not sign image:", row.id, error);
    return null;
  }
}

async function loadActiveAds(context: KeystoneContext): Promise<PublicAd[]> {
  const today = new Date(`${mxToday()}T00:00:00.000Z`);
  const rows = await prismaOf(context).ad.findMany({
    where: {
      status: AD_STATUS.ACTIVE,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: today } }] },
        { OR: [{ endDate: null }, { endDate: { gte: today } }] },
      ],
    },
    orderBy: [{ weight: "desc" }, { createdAt: "desc" }],
    take: ACTIVE_ADS_MAX,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      brandLabel: true,
      ctaLabel: true,
      tone: true,
      image_id: true,
      image_extension: true,
      url: true,
      placements: true,
      weight: true,
      geoScope: true,
      lat: true,
      lng: true,
      radiusKm: true,
      storeProduct: { select: { id: true, slug: true, status: true } },
      petPlace: { select: { id: true, slug: true } },
      animal: { select: { id: true, slug: true, duplicateOfId: true } },
    },
  });
  if (rows instanceof Error) throw rows;

  const live = (rows as AdRow[])
    .map((row) => ({ row, href: hrefOf(row) }))
    .filter((entry): entry is { row: AdRow; href: string } => Boolean(entry.href));

  // An ad without its own image uses its target's cover: two queries for the whole list.
  const productIds = live.filter(({ row }) => !row.image_id && row.storeProduct).map(({ row }) => row.storeProduct!.id);
  const animalIds = live.filter(({ row }) => !row.image_id && row.animal).map(({ row }) => row.animal!.id);
  const [productCovers, animalCovers] = await Promise.all([
    productIds.length ? loadStoreCovers(context, productIds) : Promise.resolve(new Map()),
    animalIds.length ? getAnimalCoverUrls(animalIds, context) : Promise.resolve(new Map<string, string>()),
  ]);

  return Promise.all(
    live.map(async ({ row, href }) => {
      const own = await signAdImage(context, row);
      const fallback = row.storeProduct
        ? productCovers.get(row.storeProduct.id)?.url ?? null
        : row.animal
          ? animalCovers.get(row.animal.id) ?? null
          : null;
      const isRadius = row.geoScope === AD_GEO_SCOPE.RADIUS && row.lat !== null && row.lng !== null;
      return {
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body ?? "",
        brandLabel: row.brandLabel ?? "",
        ctaLabel: row.ctaLabel ?? "",
        tone: row.tone,
        imageUrl: own ?? fallback,
        href,
        placements: Array.isArray(row.placements) ? (row.placements as string[]) : [],
        weight: row.weight,
        targetId: row.storeProduct?.id ?? row.petPlace?.id ?? row.animal?.id ?? null,
        geoScope: isRadius ? AD_GEO_SCOPE.RADIUS : AD_GEO_SCOPE.NATIONAL,
        lat: isRadius ? row.lat : null,
        lng: isRadius ? row.lng : null,
        radiusKm: isRadius ? row.radiusKm : null,
      };
    }),
  );
}

/**
 * Ads live right now, from memory for `ACTIVE_ADS_CACHE_MS`. Requests that arrive while the list is
 * loading share that one load. The signed image URLs last 1 h, well beyond the cache.
 */
export async function getActiveAds(context: KeystoneContext): Promise<PublicAd[]> {
  if (cache && Date.now() - cache.at < ACTIVE_ADS_CACHE_MS) return cache.value;
  if (!pending) {
    const startedAt = generation;
    const load = loadActiveAds(context)
      .then((value) => {
        if (startedAt === generation) cache = { value, at: Date.now() };
        return value;
      })
      .finally(() => {
        if (pending === load) pending = null;
      });
    pending = load;
  }
  return pending;
}
