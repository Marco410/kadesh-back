import type { KeystoneContext } from "@keystone-6/core/types";
import { frontendUrlFor } from "../../models/Blog/Post/Post.hooks";
import { commentTask, getTask, setTaskStatus } from "../intregrations/clickup";
import {
  attachImageToPost,
  deleteStoredPostImage,
  resolvePostImage,
  type StoredPostImage,
} from "./postImage";
import { productForClickUpList, taskToScheduledPost } from "./taskToPost";

type ExistingPost = { id: string; url?: string | null; product?: string | null };

function postPublicUrl(product: string, url: string | null | undefined, id: string): string {
  return `${frontendUrlFor(product)}/blog/${url || id}`;
}

function formatInMexicoCity(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

async function findPostByClickUpTask(
  context: KeystoneContext,
  taskId: string,
): Promise<ExistingPost | null> {
  const rows = (await context.sudo().query.Post.findMany({
    where: { clickupTaskId: { equals: taskId } },
    query: "id url product",
    take: 1,
  })) as ExistingPost[];
  return rows[0] ?? null;
}

function isClickUpTaskConflict(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("clickupTaskId");
}

async function commentExisting(taskId: string, post: ExistingPost): Promise<void> {
  const url = postPublicUrl(post.product || "pet", post.url, post.id);
  await commentTask(taskId, `Este post ya estaba programado. URL: ${url}`);
}

/**
 * Tarea en "aprobado" → Post programado. Otra lista del workspace se ignora.
 * Lanza si algo falla después de saber que la lista es de Pet o Negocios;
 * el webhook marca la tarea como "error".
 */
export async function scheduleApprovedClickUpTask(
  taskId: string,
  context: KeystoneContext,
): Promise<void> {
  // Si ni siquiera pudimos leer la tarea, no cambiamos el estado: el webhook es
  // del workspace entero y podría no ser una lista de publicaciones.
  let task;
  try {
    task = await getTask(taskId);
  } catch (err) {
    console.error(`[clickup] no se pudo leer la tarea ${taskId}`, err);
    return;
  }
  if (!task) return;

  const product = productForClickUpList(task.list?.id);
  if (!product) {
    console.log(
      `[clickup] tarea ${taskId} de la lista ${task.list?.id ?? "desconocida"} ignorada`,
    );
    return;
  }

  const draft = taskToScheduledPost(task, product);
  const existing = await findPostByClickUpTask(context, taskId);
  if (existing) {
    await commentExisting(taskId, existing);
    return;
  }

  const resolved = await resolvePostImage(task, context);
  const image = resolved.image;
  let createdId: string | null = null;
  try {
    const created = (await context.sudo().query.Post.createOne({
      data: {
        title: draft.title,
        product: draft.product,
        published: true,
        publishedAt: draft.publishedAt.toISOString(),
        excerpt: draft.excerpt,
        clickupTaskId: draft.clickupTaskId,
        ...(draft.content.length > 0 ? { content: draft.content } : {}),
      },
      query: "id url product",
    })) as ExistingPost;
    createdId = created.id;
    await attachImageToPost(context, created.id, image);

    await setTaskStatus(taskId, "programado");
    const url = postPublicUrl(created.product || product, created.url, created.id);
    const when = formatInMexicoCity(draft.publishedAt);
    const credit = resolved.pixabayCredit
      ? `\nFoto: ${resolved.pixabayCredit.user} en Pixabay — ${resolved.pixabayCredit.pageURL}`
      : "";
    try {
      await commentTask(taskId, `Programado para ${when}. URL: ${url}${credit}`);
    } catch (err) {
      console.error("[clickup] el post quedó programado pero no se pudo comentar", err);
    }
  } catch (err) {
    await rollbackCreatedPost(context, createdId, image);
    if (isClickUpTaskConflict(err)) {
      const raced = await findPostByClickUpTask(context, taskId);
      if (raced) {
        await commentExisting(taskId, raced);
        return;
      }
    }
    throw err;
  }
}

async function rollbackCreatedPost(
  context: KeystoneContext,
  postId: string | null,
  image: StoredPostImage,
): Promise<void> {
  if (postId) {
    await context
      .sudo()
      .prisma.post.delete({ where: { id: postId } })
      .catch((deleteErr: unknown) => {
        console.error("[clickup] no se pudo borrar el post a medias", deleteErr);
      });
  }
  await deleteStoredPostImage(context, image).catch((deleteErr: unknown) => {
    console.error("[clickup] no se pudo borrar la imagen del post a medias", deleteErr);
  });
}
