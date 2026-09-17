/* eslint-disable no-console */
/**
 * One-off backfill for PetPlace.slug after adding the field.
 *
 *   pnpm tsx utils/seed/backfill_pet_place_slugs.ts
 *
 * Safe to re-run: places that already have a slug are skipped.
 */
import { getContext } from "@keystone-6/core/context";
import * as PrismaModule from "@prisma/client";
import config from "../../keystone";
import { persistPetPlaceSlugIfMissing } from "../../models/PetPlace/PetPlace.hooks";

type PetPlaceSlugRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  municipality?: string | null;
  state?: string | null;
};

async function main() {
  const context = getContext(config, PrismaModule).sudo();
  const places = (await context.query.PetPlace.findMany({
    query: `
      id
      name
      slug
      municipality
      state
    `,
  })) as PetPlaceSlugRow[];

  let filled = 0;
  let skipped = 0;

  for (const place of places) {
    if (!place.id) continue;
    if (place.slug) {
      skipped += 1;
      continue;
    }
    const slug = await persistPetPlaceSlugIfMissing(place, context);
    if (slug) filled += 1;
  }

  console.log(`PetPlace slugs: ${filled} filled, ${skipped} already set`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
