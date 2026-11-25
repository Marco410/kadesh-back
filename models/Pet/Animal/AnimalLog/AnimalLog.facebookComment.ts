import type { KeystoneContext } from "@keystone-6/core/types";
import { PRODUCT } from "../../../../utils/constants/product";
import { commentOnFacebookPost, deleteFacebookObject } from "../../../../utils/intregrations/facebook";
import { animalPublicUrl } from "../Animal.hooks";
import {
  buildAnimalLogFacebookComment,
  LOG_COMMENT_ANIMAL_QUERY,
  type LogCommentAnimal,
  type PostLog,
} from "../Animal.facebookPost";

/**
 * Cada registro nuevo (`AnimalLog`) de un animal que ya salió en la Página de Facebook de Pet se
 * comenta en ese post, sea de quien sea (dueño, admin o el servidor). Al borrar el registro se
 * borra su comentario.
 *
 * - Sin `facebookPostId` no hace nada.
 * - Registros creados antes del post no se comentan: el post ya trae el primer registro.
 * - Una consulta y una llamada a Facebook por registro; nunca lanza ni frena la operación.
 */

type HookArgs = {
  operation: string;
  item?: Record<string, any> | null;
  originalItem?: Record<string, any> | null;
  context: KeystoneContext;
};

type AnimalRow = LogCommentAnimal & {
  slug?: string | null;
  facebookPostId?: string | null;
  facebookPublishedAt?: string | null;
};

async function commentNewLog(log: Record<string, any>, context: KeystoneContext): Promise<void> {
  const animalId = typeof log.animalId === "string" ? log.animalId : null;
  if (!animalId || log.facebookCommentId) return;

  const sudo = context.sudo();
  const animal = (await sudo.query.Animal.findOne({
    where: { id: animalId },
    query: LOG_COMMENT_ANIMAL_QUERY,
  })) as AnimalRow | null;
  const postId = animal?.facebookPostId?.trim();
  if (!animal || !postId || !animal.slug) return;

  const publishedAt = animal.facebookPublishedAt ? new Date(animal.facebookPublishedAt).getTime() : 0;
  const createdAt = log.createdAt ? new Date(log.createdAt).getTime() : Date.now();
  if (publishedAt && createdAt <= publishedAt) return;

  const message = buildAnimalLogFacebookComment(animal, log as PostLog, animalPublicUrl(animal.slug));
  const result = await commentOnFacebookPost({ product: PRODUCT.PET, postId, message });
  if (!result?.id) return;

  await sudo.db.AnimalLog.updateOne({
    where: { id: String(log.id) },
    data: { facebookCommentId: result.id },
  });
}

async function deleteLogComment(log: Record<string, any>): Promise<void> {
  const commentId = typeof log.facebookCommentId === "string" ? log.facebookCommentId.trim() : "";
  if (!commentId) return;
  await deleteFacebookObject({ product: PRODUCT.PET, objectId: commentId });
}

export async function syncAnimalLogFacebookComment({
  operation,
  item,
  originalItem,
  context,
}: HookArgs): Promise<void> {
  try {
    if (operation === "create" && item?.id) await commentNewLog(item, context);
    else if (operation === "delete" && originalItem?.id) await deleteLogComment(originalItem);
  } catch (error) {
    const logId = item?.id ?? originalItem?.id;
    console.error("[facebook] No se pudo sincronizar el comentario del registro", { logId }, error);
  }
}
