import { KeystoneContext } from "@keystone-6/core/types";

const EMOJI_RE =
  /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{2934}\u{2935}]|[\u{2190}-\u{21FF}]/gu;

/** Static routes under `/veterinarias/` that must not collide with a slug. */
const RESERVED_SLUGS = new Set(["registro"]);

export function slugifyPetPlace(value: string): string {
  const cleaned = value
    .replace(EMOJI_RE, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (cleaned.length <= 48) return cleaned;
  return cleaned.slice(0, 48).replace(/-+$/g, "");
}

export function buildPetPlaceSlug(input: {
  name?: string | null;
  municipality?: string | null;
  state?: string | null;
}): string {
  const nameSlug = slugifyPetPlace(input.name ?? "") || "clinica";
  const citySlug =
    slugifyPetPlace(input.municipality ?? "") ||
    slugifyPetPlace(input.state ?? "");
  const parts = [nameSlug];
  if (citySlug && !nameSlug.includes(citySlug)) parts.push(citySlug);
  let slug = parts.join("-").replace(/-+/g, "-");
  if (RESERVED_SLUGS.has(slug)) {
    slug = `clinica-${slug}`;
  }
  return slug;
}

function isUniqueSlugError(error: unknown): boolean {
  const candidate = error as {
    code?: string;
    extensions?: { prisma?: { code?: string } };
  };
  return (
    candidate?.code === "P2002" ||
    candidate?.extensions?.prisma?.code === "P2002"
  );
}

export async function ensureUniquePetPlaceSlug(
  base: string,
  petPlaceId: string,
  context: KeystoneContext,
): Promise<string> {
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = await context.sudo().db.PetPlace.findOne({
      where: { slug: candidate },
    });
    if (!existing || existing.id === petPlaceId) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

async function persistPetPlaceSlug(
  petPlaceId: string,
  input: {
    name?: string | null;
    municipality?: string | null;
    state?: string | null;
  },
  context: KeystoneContext,
) {
  const base = buildPetPlaceSlug(input);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = await ensureUniquePetPlaceSlug(base, petPlaceId, context);
    try {
      await context.sudo().db.PetPlace.updateOne({
        where: { id: petPlaceId },
        data: { slug },
      });
      return slug;
    } catch (error) {
      if (!isUniqueSlugError(error) || attempt === 7) throw error;
    }
  }

  throw new Error(`Could not assign a unique slug for pet place ${petPlaceId}`);
}

export async function persistPetPlaceSlugIfMissing(
  place: {
    id: string;
    name?: string | null;
    slug?: string | null;
    municipality?: string | null;
    state?: string | null;
  },
  context: KeystoneContext,
): Promise<string | null> {
  if (place.slug) return place.slug;
  try {
    return await persistPetPlaceSlug(
      place.id,
      {
        name: place.name,
        municipality: place.municipality,
        state: place.state,
      },
      context,
    );
  } catch (error) {
    console.error("Error backfilling pet place slug:", error);
    return null;
  }
}

/**
 * Assigns a stable unique slug on create. Never regenerates on later edits
 * of the name — shared URLs must not break.
 */
export const petPlaceSlugAfterOperation = {
  afterOperation: async ({
    operation,
    item,
    context,
  }: {
    operation: string;
    item: any;
    context: KeystoneContext;
  }) => {
    if (operation !== "create" || !item?.id || item.slug) return;

    try {
      await persistPetPlaceSlug(
        item.id,
        {
          name: item.name,
          municipality: item.municipality,
          state: item.state,
        },
        context,
      );
    } catch (error) {
      console.error("Error generating pet place slug:", error);
    }
  },
};
