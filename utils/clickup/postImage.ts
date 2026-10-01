import { Readable } from "stream";
import type { KeystoneContext } from "@keystone-6/core/types";
import { imageSize } from "image-size";
import {
  downloadClickUpFile,
  getTaskComments,
  type ClickUpAttachment,
  type ClickUpComment,
  type ClickUpTask,
} from "../intregrations/clickup";
import { findPixabayPhoto, type PixabayCredit } from "../intregrations/pixabay";

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

export type ResolvedPostImage = {
  image: StoredPostImage;
  /** Presente solo cuando la portada salió de Pixabay. La URL no se guarda en el post. */
  pixabayCredit: PixabayCredit | null;
};

const NO_STOCK_IMAGE =
  "No hay imagen: adjunta una o agrega un comentario 'imagen: palabras en inglés' y vuelve a aprobar.";

const IMAGE_LINE = /^\s*imagen:\s*(.*)$/i;

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

type ImageExtension = "jpg" | "png" | "webp";

function extensionFromBuffer(buffer: Buffer): ImageExtension {
  let probed: { type?: string };
  try {
    probed = imageSize(buffer);
  } catch {
    throw new Error("La imagen debe ser jpg, png o webp.");
  }
  if (probed.type !== "jpg" && probed.type !== "png" && probed.type !== "webp") {
    throw new Error("La imagen debe ser jpg, png o webp.");
  }
  return probed.type;
}

/**
 * Valida el buffer (8 MB, jpg/png/webp) y lo sube a `s3_posts`.
 * Sin `expected`, la extensión sale del archivo. Con `expected`, el archivo tiene que ser esa.
 */
async function storeImageBuffer(
  buffer: Buffer,
  context: KeystoneContext,
  expected?: ImageExtension,
): Promise<StoredPostImage> {
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("La imagen pesa más de 8 MB.");
  const extension = expected ?? extensionFromBuffer(buffer);
  assertBufferMatches(buffer, extension);
  return uploadToPostStorage(context, buffer, extension);
}

function bufferIsUsableImage(buffer: Buffer): boolean {
  if (buffer.length > MAX_IMAGE_BYTES) return false;
  try {
    assertBufferMatches(buffer, extensionFromBuffer(buffer));
    return true;
  } catch {
    return false;
  }
}

/** El adjunto, si existe, se usa tal cual. Si no sirve, no se busca en Pixabay. */
async function imageFromAttachment(
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
  return storeImageBuffer(buffer, context, extension);
}

function commentPlainText(comment: ClickUpComment): string {
  if (typeof comment.comment_text === "string" && comment.comment_text.trim()) {
    return comment.comment_text;
  }
  if (!Array.isArray(comment.comment)) return "";
  return comment.comment.map((part) => part.text ?? "").join("");
}

function commentTime(comment: ClickUpComment): number {
  const ms = typeof comment.date === "number" ? comment.date : Number(comment.date);
  return Number.isFinite(ms) ? ms : 0;
}

/** Palabras del comentario más reciente cuya línea empieza con `imagen:`. Máximo 100 caracteres. */
export function imageQueryFromComments(comments: ClickUpComment[]): string | null {
  const newestFirst = [...comments].sort((a, b) => commentTime(b) - commentTime(a));
  for (const comment of newestFirst) {
    for (const line of commentPlainText(comment).split(/\r?\n/)) {
      const match = line.match(IMAGE_LINE);
      if (!match) continue;
      const words = match[1].trim().slice(0, 100).trim();
      if (words) return words;
    }
  }
  return null;
}

/**
 * Portada del post. Un adjunto `image/*` gana y, si no sirve, es error.
 * Sin adjunto se busca en Pixabay. Si tampoco hay foto, el mensaje es el del comentario en ClickUp.
 */
export async function resolvePostImage(
  task: ClickUpTask,
  context: KeystoneContext,
): Promise<ResolvedPostImage> {
  if (firstImageAttachment(task)) {
    return { image: await imageFromAttachment(task, context), pixabayCredit: null };
  }

  const comments = (await getTaskComments(task.id)) ?? [];
  const query = imageQueryFromComments(comments);
  if (!query) throw new Error(NO_STOCK_IMAGE);

  const photo = await findPixabayPhoto(query, {
    maxBytes: MAX_IMAGE_BYTES,
    accept: bufferIsUsableImage,
  });
  if (!photo) throw new Error(NO_STOCK_IMAGE);

  return {
    image: await storeImageBuffer(photo.buffer, context),
    pixabayCredit: photo.credit,
  };
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
