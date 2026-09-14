import { KeystoneContext } from "@keystone-6/core/types";

const EMOJI_RE =
  /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{2934}\u{2935}]|[\u{2190}-\u{21FF}]/gu;

const UNNAMED_RE = /^(sin-?nombre|n-?a|na|unnamed)?$/;

const TYPE_SLUG: Record<string, string> = {
  dog: "perro",
  perro: "perro",
  cat: "gato",
  gato: "gato",
  bird: "ave",
  ave: "ave",
  fish: "pez",
  pez: "pez",
  reptil: "reptil",
  mammal: "mamifero",
  mamifero: "mamifero",
};

const STATUS_SLUG: Record<string, string> = {
  lost: "perdido",
  found: "encontrado",
  in_adoption: "adopcion",
  abandoned: "abandonado",
  rescued: "rescatado",
  adopted: "adoptado",
  in_family: "en-familia",
};

const STATUS_SLUG_VALUES = Object.values(STATUS_SLUG);

export function slugify(value: string): string {
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

  if (cleaned.length <= 40) return cleaned;
  return cleaned.slice(0, 40).replace(/-+$/g, "");
}

export function shortAnimalId(id: string): string {
  return id.slice(-6).toLowerCase();
}

export function animalSlugHasStatus(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return STATUS_SLUG_VALUES.some(
    (status) => slug.includes(`-${status}-`) || slug.startsWith(`${status}-`),
  );
}

export function buildAnimalSlug(input: {
  name?: string | null;
  type?: string | null;
  status?: string | null;
  city?: string | null;
  id: string;
}): string {
  const nameSlug = slugify(input.name ?? "");
  const isUnnamed = !nameSlug || UNNAMED_RE.test(nameSlug);
  const typeKey = (input.type ?? "").toLowerCase();
  const typeSlug = TYPE_SLUG[typeKey] || slugify(input.type ?? "");
  const statusKey = (input.status ?? "").toLowerCase();
  const statusSlug =
    !statusKey || statusKey === "register"
      ? ""
      : STATUS_SLUG[statusKey] || slugify(input.status ?? "");
  const citySlug = slugify(input.city ?? "");
  const shortId = shortAnimalId(input.id);

  const parts: string[] = [];
  if (!isUnnamed) {
    parts.push(nameSlug);
    if (!statusSlug && typeSlug) parts.push(typeSlug);
  } else {
    parts.push(typeSlug || "animal");
  }

  if (statusSlug) parts.push(statusSlug);
  if (citySlug) parts.push(citySlug);
  parts.push(shortId);

  const slug = parts.filter(Boolean).join("-").replace(/-+/g, "-");
  if (slug === "nuevo") return "animal-nuevo";
  return slug;
}

export async function ensureUniqueAnimalSlug(
  base: string,
  animalId: string,
  context: KeystoneContext,
): Promise<string> {
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = await context.sudo().db.Animal.findOne({
      where: { slug: candidate },
    });
    if (!existing || existing.id === animalId) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

async function persistAnimalSlug(
  animalId: string,
  input: {
    name?: string | null;
    type?: string | null;
    status?: string | null;
    city?: string | null;
  },
  context: KeystoneContext,
) {
  const slug = await ensureUniqueAnimalSlug(
    buildAnimalSlug({ ...input, id: animalId }),
    animalId,
    context,
  );

  await context.sudo().db.Animal.updateOne({
    where: { id: animalId },
    data: { slug },
  });

  return slug;
}

export async function persistAnimalSlugIfMissing(
  animal: {
    id: string;
    name?: string | null;
    slug?: string | null;
    animal_type?: { name?: string | null } | null;
  },
  log: { status?: string | null; city?: string | null } | null,
  context: KeystoneContext,
): Promise<string | null> {
  if (animal.slug) return animal.slug;
  try {
    return await persistAnimalSlug(
      animal.id,
      {
        name: animal.name,
        type: animal.animal_type?.name,
        status: log?.status,
        city: log?.city,
      },
      context,
    );
  } catch (error) {
    console.error("Error backfilling animal slug:", error);
    return null;
  }
}

/**
 * Assigns a stable unique slug on create. Never regenerates on later edits
 * of the name — shared URLs must not break.
 */
export const animalSlugAfterOperation = {
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
      const animal = await context.sudo().query.Animal.findOne({
        where: { id: item.id },
        query: "id name animal_type { name }",
      });
      if (!animal) return;

      await persistAnimalSlug(
        item.id,
        {
          name: animal.name,
          type: animal.animal_type?.name,
        },
        context,
      );
    } catch (error) {
      console.error("Error generating animal slug:", error);
    }
  },
};

/**
 * On the first log, enrich the slug with status and city. Later logs leave
 * it alone so WhatsApp/cartel links stay valid.
 */
export const animalLogSlugAfterOperation = {
  afterOperation: async ({
    operation,
    item,
    context,
  }: {
    operation: string;
    item: any;
    context: KeystoneContext;
  }) => {
    if (operation !== "create") return;

    const animalId = item?.animalId ?? item?.animal;
    if (!animalId || typeof animalId !== "string") return;

    try {
      const logs = await context.sudo().query.AnimalLog.findMany({
        where: { animal: { id: { equals: animalId } } },
        query: "id",
      });
      if (logs.length !== 1) return;

      const animal = await context.sudo().query.Animal.findOne({
        where: { id: animalId },
        query: "id name slug animal_type { name }",
      });
      if (!animal || animalSlugHasStatus(animal.slug)) return;

      await persistAnimalSlug(
        animalId,
        {
          name: animal.name,
          type: animal.animal_type?.name,
          status: item.status,
          city: item.city,
        },
        context,
      );
    } catch (error) {
      console.error("Error enriching animal slug from log:", error);
    }
  },
};
