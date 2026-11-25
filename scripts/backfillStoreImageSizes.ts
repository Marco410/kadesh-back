/**
 * Fills `StoreProductImage.image_width` / `image_height` on store photos that have no size (photos
 * saved as an external link). The Meta feed leaves out photos under 500×500, but lets through those
 * without a size, so one of 482×476 reached the catalog.
 *
 * Downloads each original (R2 or its external URL, up to 25 MB, one at a time) and reads its size.
 * New photos without a size get it the first time `/media/store/<id>.jpg` serves them. Can be run
 * again: it only touches rows whose size is still empty.
 *
 *   pnpm store:backfill-image-sizes              # only reports what would change
 *   pnpm store:backfill-image-sizes --apply      # saves it
 *   pnpm store:backfill-image-sizes:prod --apply # against production (config/.env.prod)
 */
import "../env";
import { PrismaClient } from "@prisma/client";
import { META_FEED_IMAGE_MIN_PX } from "../utils/store/metaFeed";
import { imageSize, loadStoreImageOriginal } from "../utils/store/feedImages";

const apply = process.argv.includes("--apply");

const prisma = new PrismaClient({
  datasources: {
    postgresql: {
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connection_limit=2`,
    },
  },
});

async function main() {
  const rows = (await (prisma as any).storeProductImage.findMany({
    where: { OR: [{ image_width: null }, { image_height: null }] },
    select: { id: true, image_id: true, image_extension: true, externalUrl: true, productId: true },
    orderBy: { createdAt: "asc" },
  })) as Array<{
    id: string;
    image_id: string | null;
    image_extension: string | null;
    externalUrl: string | null;
    productId: string | null;
  }>;

  console.log(`Photos without a size: ${rows.length}`);
  const found: Array<{ id: string; width: number; height: number }> = [];
  let unreadable = 0;
  for (const row of rows) {
    let size: { width: number; height: number } | null = null;
    try {
      const original = await loadStoreImageOriginal(row);
      size = original ? await imageSize(original) : null;
    } catch (error) {
      console.warn(`  ${row.id}: could not read (${(error as Error).message})`);
    }
    if (!size) {
      unreadable += 1;
      console.log(`  ${row.id} (product ${row.productId}): no size, left as is`);
      continue;
    }
    const small = size.width < META_FEED_IMAGE_MIN_PX || size.height < META_FEED_IMAGE_MIN_PX;
    console.log(`  ${row.id} (product ${row.productId}): ${size.width}x${size.height}${small ? "  ← under 500x500" : ""}`);
    found.push({ id: row.id, ...size });
  }
  const small = found.filter((row) => row.width < META_FEED_IMAGE_MIN_PX || row.height < META_FEED_IMAGE_MIN_PX);
  console.log(`Measured: ${found.length} (under 500x500: ${small.length}); unreadable: ${unreadable}`);

  if (!apply) {
    console.log("Report mode. Run with --apply to save them.");
    return;
  }
  let updated = 0;
  for (const row of found) {
    updated += await prisma.$executeRaw`
      UPDATE "StoreProductImage" SET "image_width" = ${row.width}, "image_height" = ${row.height}
      WHERE "id" = ${row.id} AND ("image_width" IS NULL OR "image_height" IS NULL)`;
  }
  console.log(`Updated: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
