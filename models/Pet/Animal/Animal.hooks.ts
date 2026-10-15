import { KeystoneContext } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../utils/access/tenant";
import { PRODUCT } from "../../../utils/constants/product";
import { postToFacebookPage } from "../../../utils/intregrations/facebook";
import { sendAdminNewAnimalEmail } from "../../../utils/helpers/sendgrid";
import { adminNotificationEmailsEnabled, notify } from "../../../utils/notifications/notify";
import { NOTIFICATION_TYPE } from "../../Notification/constants";
import {
  noteAnimalCoverSaved,
  noteAnimalSlugSettled,
  setAnimalFacebookPublisher,
  watchAnimalForFacebook,
} from "./scheduleAnimalFacebookPost";

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

function petFrontendBaseUrl(): string {
  return (
    process.env.PET_FRONTEND_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    "https://pet.kadesh.com.mx"
  ).replace(/\/$/, "");
}

function animalPublicUrl(slug: string): string {
  return `${petFrontendBaseUrl()}/animales/${slug}`;
}

function sessionCreator(session: KeystoneContext["session"]): {
  name: string;
  email: string;
} {
  const data = session?.data as
    | { name?: string; lastName?: string; email?: string }
    | undefined;
  const name = [data?.name, data?.lastName].filter(Boolean).join(" ").trim();
  return {
    name: name || "Usuario",
    email: data?.email?.trim() || "",
  };
}

/**
 * Publica el animal en la Página de Facebook de Pet y deja registro (`facebookPostId`,
 * `facebookPublishedAt`, `facebookPublishedBy`): así Operaciones sabe si ya salió y no lo repite.
 * Devuelve el id del post, o null si no se publicó (Página sin configurar, sin slug o error).
 */
async function publishAnimalToFacebook(
  animal: {
    id: string;
    name?: string | null;
    physical_description?: string | null;
    slug?: string | null;
  },
  context: KeystoneContext,
): Promise<string | null> {
  if (!animal.slug) {
    console.warn("[facebook] Animal sin slug; no se publica en Facebook.");
    return null;
  }

  const message = animal.physical_description
    ? `${animal.name}\n\n${animal.physical_description}`
    : animal.name || "Nuevo animal en Kadesh";

  const result = await postToFacebookPage({
    product: PRODUCT.PET,
    message,
    link: animalPublicUrl(animal.slug),
  });
  if (!result?.id) return null;

  console.log(`[facebook] Animal publicado en la Página de Pet: ${result.id}`);
  const publishedById = context.session?.data?.id ?? null;
  await context.sudo().db.Animal.updateOne({
    where: { id: animal.id },
    data: {
      facebookPostId: result.id,
      facebookPublishedAt: new Date().toISOString(),
      ...(publishedById ? { facebookPublishedBy: { connect: { id: publishedById } } } : {}),
    },
  });
  return result.id;
}

/** Relee el slug ya definitivo (después del primer log) y publica ese link. */
export async function publishAnimalToFacebookById(
  animalId: string,
  context: KeystoneContext,
): Promise<string | null> {
  const animal = await context.sudo().query.Animal.findOne({
    where: { id: animalId },
    query: "id name physical_description slug",
  });
  if (!animal?.slug) {
    console.warn("[facebook] Animal sin slug; no se publica en Facebook.");
    return null;
  }
  return publishAnimalToFacebook(
    {
      id: String(animal.id),
      name: animal.name ?? null,
      physical_description: animal.physical_description ?? null,
      slug: animal.slug,
    },
    context,
  );
}

setAnimalFacebookPublisher(publishAnimalToFacebookById);

/** Aviso a los admins de un animal nuevo de un usuario: campana de Operaciones (y correo si se pide). */
async function notifyAdminsNewAnimal(
  context: KeystoneContext,
  animal: {
    id: string;
    name?: string | null;
    slug?: string | null;
    animal_type?: { name?: string | null } | null;
  },
  creator: { name: string; email: string },
): Promise<void> {
  const slug = animal.slug || undefined;
  const animalName = animal.name || "(sin nombre)";
  const animalType = animal.animal_type?.name || undefined;
  const publicUrl = slug ? animalPublicUrl(slug) : undefined;

  await notify(context, {
    audience: "platform_admins",
    product: "pet",
    type: NOTIFICATION_TYPE.ANIMAL_CREATED,
    title: `Nuevo animal: ${animalName}`,
    body: [animalType, `publicado por ${creator.name}`].filter(Boolean).join(" · "),
    entityType: "Animal",
    entityId: animal.id,
    url: publicUrl ?? null,
    metadata: { slug: slug ?? null, animalType: animalType ?? null },
    templateValues: { animalName, animalType, creatorName: creator.name },
  });

  if (!adminNotificationEmailsEnabled()) return;
  await sendAdminNewAnimalEmail({
    animalId: animal.id,
    animalName,
    animalType,
    slug,
    publicUrl,
    creatorName: creator.name,
    creatorEmail: creator.email,
  });
}

/**
 * On create: assign a stable unique slug, then side effects —
 * platform admin → Facebook Pet page once the public slug and cover exist;
 * other signed-in users → admin email.
 * No session (seed/scripts) skips Facebook and email.
 */
export const animalCreateSideEffectsHook = {
  afterOperation: async ({
    operation,
    item,
    context,
  }: {
    operation: string;
    item: any;
    context: KeystoneContext;
  }) => {
    if (operation !== "create" || !item?.id) return;

    const animalId = String(item.id);

    try {
      const animal = await context.sudo().query.Animal.findOne({
        where: { id: animalId },
        query: "id name slug animal_type { name }",
      });
      if (!animal) return;
      // Un log anidado ya pudo dejar el slug con status y ciudad. No pisarlo.
      if (!animal.slug) {
        await persistAnimalSlug(
          animalId,
          {
            name: animal.name,
            type: animal.animal_type?.name,
          },
          context,
        );
      }
    } catch (error) {
      console.error("Error generating animal slug:", error);
    }

    if (!context.session?.data) return;

    try {
      const animal = await context.sudo().query.Animal.findOne({
        where: { id: animalId },
        query:
          "id name physical_description slug animal_type { name } user { name email } multimedia { id } logs { id }",
      });
      if (!animal) return;

      const resolved: {
        id: string;
        name?: string | null;
        physical_description?: string | null;
        slug?: string | null;
        animal_type?: { name?: string | null } | null;
        user?: { name?: string | null; email?: string | null } | null;
      } = {
        id: String(animal.id),
        name: animal.name ?? null,
        physical_description: animal.physical_description ?? null,
        slug: animal.slug ?? null,
        animal_type: animal.animal_type ?? null,
        user: animal.user ?? null,
      };

      if (isPlatformAdmin(context.session)) {
        const hasCover =
          Array.isArray(animal.multimedia) && animal.multimedia.length > 0;
        const hasLog = Array.isArray(animal.logs) && animal.logs.length > 0;
        // Alta anidada (Admin): slug y portada ya están. El formulario público
        // manda el log y las fotos después; publicar aquí cachea el link viejo.
        if (hasCover && hasLog && resolved.slug) {
          await publishAnimalToFacebook(resolved, context);
        } else {
          watchAnimalForFacebook(animalId, context);
        }
      } else {
        const fromSession = sessionCreator(context.session);
        const creator = {
          name:
            fromSession.name !== "Usuario"
              ? fromSession.name
              : resolved.user?.name?.trim() || "Usuario",
          email: fromSession.email || resolved.user?.email?.trim() || "",
        };
        await notifyAdminsNewAnimal(context, resolved, creator);
      }
    } catch (error) {
      console.error(
        "[animal] Error en side effect de create (Facebook/aviso):",
        error,
      );
    }
  },
};

/** @deprecated Use animalCreateSideEffectsHook — kept as alias for callers. */
export const animalSlugAfterOperation = animalCreateSideEffectsHook;

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
      if (!animal) return;

      if (!animalSlugHasStatus(animal.slug)) {
        await persistAnimalSlug(
          animalId,
          {
            name: animal.name,
            type: animal.animal_type?.name,
            status: item.status,
            city: (item.placeLabel || "").trim() || item.city,
          },
          context,
        );
      }
      noteAnimalSlugSettled(animalId, context);
    } catch (error) {
      console.error("Error enriching animal slug from log:", error);
    }
  },
};

/** La portada ya está en storage. Si el animal espera Facebook, publica con ese slug. */
export const animalMultimediaFacebookHook = {
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
    noteAnimalCoverSaved(animalId, context);
  },
};
