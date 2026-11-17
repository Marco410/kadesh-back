import { KeystoneContext } from "@keystone-6/core/types";
import { HOME_OUTCOMES } from "../../../models/Pet/Animal/Animal.outcome";
import { animalDisplayName } from "../../../utils/pet/animalName";
import { getAnimalCoverUrls } from "../../../utils/pet/animalCovers";

/**
 * Reencuentros para la portada de KADESH Pet: casos cerrados con hogar (volvió con su familia,
 * adoptado, otro hogar) cuya persona aceptó publicar su historia (`storyConsent`).
 *
 * Pública y sin sesión. Solo lo que ya se ve en la ficha (nombre, tipo, ciudad, foto) más la
 * historia, recortada y sin teléfonos, correos ni enlaces. Nunca el contacto ni quién lo reportó.
 * Cacheada en memoria 10 min: la portada la pide con la misma ventana.
 *
 * Para quitar una historia: en el Admin UI, apagar `storyConsent` o vaciar `outcomeStory`.
 */
const CACHE_MS = 10 * 60 * 1000;
const DEFAULT_TAKE = 6;
const MAX_TAKE = 12;
const STORY_MAX = 280;

const typeDefs = `
  type PetReunionStory {
    id: ID!
    slug: String
    "Nombre, o la descripción («Perra café») si no se sabe."
    displayName: String!
    "reunited | adopted | other_home"
    outcome: String!
    closedAt: String
    "Recortada a 280 caracteres, sin teléfonos, correos ni enlaces."
    story: String!
    city: String
    state: String
    coverUrl: String
  }
`;

const definition = `petReunionStories(take: Int): [PetReunionStory!]!`;

type StoryRow = {
  id: string;
  slug: string | null;
  name: string;
  sex: string | null;
  color: string | null;
  typeName: string | null;
  outcome: string;
  closedAt: Date | null;
  story: string;
  city: string | null;
  state: string | null;
};

type PetReunionStory = {
  id: string;
  slug: string | null;
  displayName: string;
  outcome: string;
  closedAt: string | null;
  story: string;
  city: string | null;
  state: string | null;
  coverUrl: string | null;
};

let cache: { take: number; value: PetReunionStory[]; at: number } | null = null;

/** Sin datos de contacto en una página pública: teléfonos, correos y enlaces se quitan. */
export function publicStoryText(raw: string): string {
  const clean = raw
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    // 8 o más dígitos seguidos o separados por espacios, guiones, puntos o paréntesis.
    .replace(/\+?\(?\d[\d\s().-]{6,}\d/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= STORY_MAX) return clean;
  const cut = clean.slice(0, STORY_MAX - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > STORY_MAX * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, "")}…`;
}

async function loadStories(context: KeystoneContext, take: number): Promise<PetReunionStory[]> {
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  const rows = await prisma.$queryRaw`
    SELECT a.id, a.slug, a.name, a.sex, a.color, t.name AS "typeName", a.outcome, a."closedAt",
           a."outcomeStory" AS story, last.city, last.state
    FROM "Animal" a
    LEFT JOIN "AnimalType" t ON t.id = a."animal_type"
    LEFT JOIN LATERAL (
      SELECT l.city, l.state FROM "AnimalLog" l
      WHERE l."animal" = a.id
      ORDER BY l."date_status" DESC NULLS LAST, l."createdAt" DESC NULLS LAST
      LIMIT 1
    ) last ON true
    WHERE a.outcome = ANY(${HOME_OUTCOMES}::text[])
      AND a."storyConsent" = true
      AND btrim(a."outcomeStory") <> ''
      AND a."duplicateOf" IS NULL
    ORDER BY a."closedAt" DESC NULLS LAST
    LIMIT ${take}::int
  `;
  if (rows instanceof Error) throw rows;

  const list = (rows as StoryRow[])
    .map((row) => ({ row, story: publicStoryText(row.story ?? "") }))
    // Si al quitar contacto no queda nada que contar, no sale.
    .filter(({ story }) => story.length >= 10);
  const covers = await getAnimalCoverUrls(list.map(({ row }) => row.id), context);

  return list.map(({ row, story }) => ({
    id: row.id,
    slug: row.slug,
    displayName: animalDisplayName({ name: row.name, typeName: row.typeName, sex: row.sex, color: row.color }),
    outcome: row.outcome,
    closedAt: row.closedAt ? new Date(row.closedAt).toISOString() : null,
    story,
    city: row.city || null,
    state: row.state || null,
    coverUrl: covers.get(row.id) ?? null,
  }));
}

const resolver = {
  petReunionStories: async (_root: unknown, args: { take?: number | null }, context: KeystoneContext) => {
    const take = Math.min(Math.max(1, Math.floor(args.take ?? DEFAULT_TAKE)), MAX_TAKE);
    const now = Date.now();
    // Las URLs de las fotos son firmadas (1 h): la caché de 10 min queda muy por debajo.
    if (cache && cache.take === take && now - cache.at < CACHE_MS) return cache.value;
    try {
      const value = await loadStories(context, take);
      cache = { take, value, at: now };
      return value;
    } catch (error) {
      console.error("[petReunionStories]", error);
      return cache?.value ?? [];
    }
  },
};

export default { typeDefs, definition, resolver };
