import { Readable } from "stream";
import { GraphQLError } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId } from "../access/tenant";
import { findPetOwnerRole } from "../../models/Pet/Pet.access";
import { PET_OWNER_ROLE } from "../../models/Pet/constants";
import { noteAnimalCoverSaved } from "../../models/Pet/Animal/scheduleAnimalFacebookPost";

/** Mismos topes que `createAnimalReport`. */
const MAX_REPORT_PHOTOS = 3;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

type ImageExtension = "jpg" | "png" | "webp" | "gif";

/** Cartilla de la mascota en la web de Pet (pestaña Mascotas del perfil). */
export function petCardUrl(petId: string): string {
  const base = (
    process.env.PET_FRONTEND_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    "https://pet.kadesh.com.mx"
  ).replace(/\/$/, "");
  return `${base}/perfil?tab=pets&pet=${encodeURIComponent(petId)}`;
}

/** Quien llama debe ser dueño de la mascota (o el principal, con `principal: true`). */
export async function requirePetOwner(
  context: KeystoneContext,
  petId: string,
  { principal = false }: { principal?: boolean } = {},
): Promise<{ userId: string; role: string }> {
  const userId = getSessionUserId(context.session);
  if (!userId) throw new GraphQLError("Inicia sesión para continuar.");
  const role = petId ? await findPetOwnerRole(context, petId, userId) : null;
  if (!role) throw new GraphQLError("No encontramos esta mascota en tu cartilla.");
  if (principal && role !== PET_OWNER_ROLE.PRINCIPAL) {
    throw new GraphQLError("Solo el dueño principal puede hacer esto.");
  }
  return { userId, role };
}

/** Edad para el reporte: la aproximada si la escribieron; si no, la calculada ("3 años", "8 meses"). */
export function petAgeLabel(birthday?: string | null, approximateAge?: string | null): string {
  const approx = approximateAge?.trim();
  if (approx) return approx;
  if (!birthday) return "";
  const born = new Date(`${birthday.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(born.getTime())) return "";
  const now = new Date();
  const months =
    (now.getUTCFullYear() - born.getUTCFullYear()) * 12 + (now.getUTCMonth() - born.getUTCMonth()) -
    (now.getUTCDate() < born.getUTCDate() ? 1 : 0);
  if (months < 0) return "";
  if (months === 0) return "menos de 1 mes";
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "año" : "años"}`;
}

/**
 * Copia las fotos de la mascota (`s3_pets`) al reporte (`s3_animals`) con el mismo mecanismo que
 * `createAnimalReport`: descarga la URL firmada y la vuelve a guardar con `context.images`. Va
 * foto por foto y no lanza: si una falla, el reporte sigue (queda en logs).
 */
export async function copyPetPhotosToReport(
  context: KeystoneContext,
  petId: string,
  animalId: string,
): Promise<number> {
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  const photos = await prisma.petMultimedia.findMany({
    where: { petId, image_id: { not: null } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    take: MAX_REPORT_PHOTOS,
    select: { image_id: true, image_extension: true },
  });
  if (photos instanceof Error) {
    console.error("[petCard] No se pudieron leer las fotos de la mascota", { petId }, photos);
    return 0;
  }

  let copied = 0;
  for (const photo of photos as Array<{ image_id: string; image_extension: string | null }>) {
    try {
      const extension = (photo.image_extension || "jpg") as ImageExtension;
      const url = await context.images("s3_pets").getUrl(photo.image_id, extension);
      if (!/^https?:\/\//i.test(url)) {
        // Storage local (sin R2): la URL es relativa y no se puede descargar desde aquí.
        console.warn("[petCard] Foto sin URL absoluta, no se copia al reporte", { petId });
        continue;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} al descargar la foto`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > MAX_PHOTO_BYTES) throw new Error("La foto pesa más de 8 MB");
      const stored = await context
        .images("s3_animals")
        .getDataFromStream(Readable.from(buffer), `mascota.${extension}`);
      const created = await prisma.animalMultimedia.create({
        data: {
          animalId,
          order: copied + 1,
          image_id: stored.id,
          image_extension: stored.extension,
          image_filesize: stored.filesize,
          image_width: stored.width,
          image_height: stored.height,
        },
      });
      if (created instanceof Error) throw created;
      copied += 1;
    } catch (error) {
      console.error("[petCard] No se pudo copiar una foto al reporte", { petId, animalId }, error);
    }
  }
  if (copied > 0) noteAnimalCoverSaved(animalId, context);
  return copied;
}
