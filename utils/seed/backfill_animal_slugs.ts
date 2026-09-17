/* eslint-disable no-console */
/**
 * One-off backfill for Animal.slug after adding the field.
 *
 *   pnpm tsx utils/seed/backfill_animal_slugs.ts
 *
 * Safe to re-run: animals that already have a slug are skipped.
 */
import { getContext } from "@keystone-6/core/context";
import * as PrismaModule from "@prisma/client";
import config from "../../keystone";
import { persistAnimalSlugIfMissing } from "../../models/Pet/Animal/Animal.hooks";

type AnimalSlugRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  animal_type?: { name?: string | null } | null;
  logs?: Array<{ status?: string | null; city?: string | null }> | null;
};

async function main() {
  const context = getContext(config, PrismaModule).sudo();
  const animals = (await context.query.Animal.findMany({
    query: `
      id
      name
      slug
      animal_type { name }
      logs(orderBy: [{ createdAt: desc }], take: 1) {
        status
        city
      }
    `,
  })) as AnimalSlugRow[];

  let filled = 0;
  let skipped = 0;

  for (const animal of animals) {
    if (!animal.id) continue;
    if (animal.slug) {
      skipped += 1;
      continue;
    }
    const slug = await persistAnimalSlugIfMissing(
      animal,
      animal.logs?.[0] ?? null,
      context,
    );
    if (slug) filled += 1;
  }

  console.log(`Animal slugs: ${filled} filled, ${skipped} already set`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
