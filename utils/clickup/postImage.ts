import { Readable } from "stream";
import type { KeystoneContext } from "@keystone-6/core/types";
import { imageSize } from "image-size";
import {
  downloadClickUpFile,
  type ClickUpAttachment,
  type ClickUpTask,
} from "../intregrations/clickup";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type StoredPostImage = {
  id: string;
  extension: "jpg" | "png" | "webp";
  filesize: number;
  width: number;
  height: number;
};

function declaredBytes(size: ClickUpAttachment["size"]): number | null {
  if (size === null || size === undefined || size === "") return null;
  const bytes = typeof size === "number" ? size : Number(size);
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  return bytes;
}

/** Primer adjunto `image/*` que no esté borrado. No salta al siguiente si ese no sirve. */
export function firstImageAttachment(task: ClickUpTask): ClickUpAttachment | null {
  for (const attachment of task.attachments ?? []) {
    if (attachment.deleted) continue;
    const mime = attachment.mimetype?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (mime.startsWith("image/")) return attachment;
  }
  return null;
}

function assertBufferMatches(buffer: Buffer, extension: "jpg" | "png" | "webp"): void {
  let probed: { type?: string; width?: number; height?: number };
  try {
    probed = imageSize(buffer);
  } catch {
    throw new Error("La imagen debe ser jpg, png o webp.");
  }
  if (probed.type !== extension || !probed.width || !probed.height) {
    throw new Error("La imagen debe ser jpg, png o webp.");
  }
}

/**
 * Sube al storage `s3_posts` por el adapter de Keystone (`context.images`).
 * La key queda `{pathPrefix}{id}.{extension}` — `posts/` o `dev/posts/` si
 * `ENVIROMENT=DEV`, id de 16 bytes en base64url — que es lo que el campo
 * `image` firma. `uploadBufferToStorage` no sirve aquí: esas keys
 * (`whatsapp-media/...`) Keystone no las conoce y la URL firmada no abriría.
 */
async function uploadToPostStorage(
  context: KeystoneContext,
  buffer: Buffer,
  extension: "jpg" | "png" | "webp",
): Promise<StoredPostImage> {
  const images = context.images("s3_posts");
  let stored;
  try {
    stored = await images.getDataFromStream(Readable.from(buffer), `portada.${extension}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "error desconocido";
    throw new Error(`No se pudo guardar la imagen del post: ${detail}`);
  }
  if (stored.extension !== extension) {
    await images.deleteAtSource(stored.id, stored.extension).catch((deleteErr: unknown) => {
      console.error("[clickup] no se pudo borrar una imagen rechazada", deleteErr);
    });
    throw new Error("La imagen debe ser jpg, png o webp.");
  }
  return {
    id: stored.id,
    extension: stored.extension,
    filesize: stored.filesize,
    width: stored.width,
    height: stored.height,
  };
}

/**
 * Exige una imagen jpg/png/webp de hasta 8 MB. Sin adjunto, el mensaje es
 * exactamente el que se comenta en ClickUp.
 */
export async function requirePostImage(
  task: ClickUpTask,
  context: KeystoneContext,
): Promise<StoredPostImage> {
  const attachment = firstImageAttachment(task);
  if (!attachment) throw new Error("Falta adjuntar la imagen");

  const mime = attachment.mimetype?.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = EXTENSION_BY_MIME[mime];
  if (!extension) throw new Error("La imagen debe ser jpg, png o webp.");

  const declared = declaredBytes(attachment.size);
  if (declared !== null && declared > MAX_IMAGE_BYTES) {
    throw new Error("La imagen pesa más de 8 MB.");
  }
  if (!attachment.url?.trim()) throw new Error("No se pudo descargar la imagen adjunta.");

  const buffer = await downloadClickUpFile(attachment.url, MAX_IMAGE_BYTES);
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("La imagen pesa más de 8 MB.");
  assertBufferMatches(buffer, extension);
  return uploadToPostStorage(context, buffer, extension);
}

/** Escribe las columnas que el campo `image` lee para armar la URL firmada. No pasa por hooks. */
export async function attachImageToPost(
  context: KeystoneContext,
  postId: string,
  image: StoredPostImage,
): Promise<void> {
  await context.sudo().prisma.post.update({
    where: { id: postId },
    data: {
      image_id: image.id,
      image_extension: image.extension,
      image_filesize: image.filesize,
      image_width: image.width,
      image_height: image.height,
    },
  });
}

export async function deleteStoredPostImage(
  context: KeystoneContext,
  image: StoredPostImage,
): Promise<void> {
  await context.images("s3_posts").deleteAtSource(image.id, image.extension);
}
