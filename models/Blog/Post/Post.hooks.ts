import { KeystoneContext } from "@keystone-6/core/types";
import { sendNewPostEmail } from "../../../utils/helpers/sendgrid";
import { postToFacebookPage } from "../../../utils/intregrations/facebook";
import { PRODUCT, type Product } from "../../../utils/constants/product";
import { POST_CATEGORIES } from "../../../utils/constants/constants";

/** Suscriptores que reciben un post: los de su producto, o los dos si el post es `all`. */
function subscriberProductsFor(product: Product): string[] {
  return product === PRODUCT.ALL ? [PRODUCT.PET, PRODUCT.SAAS] : [product];
}

/** `Category.name` es un `select`: la API regresa el `value` (ej. "product_updates"), no el label. */
function categoryLabelFor(categoryName: string | null | undefined): string | null {
  if (!categoryName) return null;
  return (
    POST_CATEGORIES.find((category) => category.value === categoryName)?.label ??
    categoryName
  );
}

/** URL del front de cada producto. `FRONTEND_URL` se mantiene como fallback de Pet. */
function frontendUrlFor(product: string): string {
  if (product === PRODUCT.SAAS) {
    return process.env.SAAS_FRONTEND_URL?.trim() || "https://kadesh.com.mx";
  }
  return (
    process.env.PET_FRONTEND_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    "http://localhost:3000"
  );
}

/** La categoría del post debe ser del mismo producto, o de `all`. */
export const postCategoryProductHook = {
  validateInput: async ({
    operation,
    resolvedData,
    item,
    context,
    addValidationError,
  }: any) => {
    const product: string | undefined = resolvedData.product ?? item?.product;
    const categoryInput = resolvedData.category;

    // Sin cambios en producto ni categoría no hay nada que validar.
    if (operation === "update" && resolvedData.product === undefined && categoryInput === undefined) {
      return;
    }

    const categoryId: string | null | undefined =
      categoryInput === undefined
        ? item?.categoryId
        : categoryInput?.connect?.id ?? null;

    if (!categoryId || !product || product === PRODUCT.ALL) return;

    const category = await context.sudo().db.Category.findOne({
      where: { id: categoryId },
    });
    if (!category) return;

    if (category.product !== product && category.product !== PRODUCT.ALL) {
      addValidationError(
        `La categoría es de "${category.product}" y el post es de "${product}". Usa una categoría del mismo producto.`,
      );
    }
  },
};

export const postUrlHook = {
  resolveInput: async ({ resolvedData, item, context }: any) => {
    if (item && !resolvedData.title) {
      return item.url;
    }

    if (resolvedData.title) {
      return checkPostUrl(resolvedData.title, item?.id, context);
    }

    return item?.url || null;
  },
};

function sanitizeUrl(title: string): string {
  // Eliminar emojis y caracteres especiales
  // Regex para detectar emojis: https://stackoverflow.com/questions/18862256/detect-emoji-in-string-using-javascript
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{2934}\u{2935}]|[\u{2190}-\u{21FF}]/gu;
  
  let cleaned = title
    .replace(emojiRegex, '') // Eliminar emojis
    .normalize('NFD') // Normalizar caracteres con acentos
    .replace(/[\u0300-\u036f]/g, '') // Eliminar diacríticos
    .toLowerCase()
    .replace(/ñ/g, 'n') // Reemplazar ñ por n
    .replace(/[^a-z0-9\s-]/g, '') // Eliminar caracteres que no sean letras, números, espacios o guiones
    .trim()
    .replace(/\s+/g, '-') // Reemplazar espacios múltiples con un solo guion
    .replace(/-+/g, '-') // Reemplazar múltiples guiones con uno solo
    .replace(/^-+|-+$/g, ''); // Eliminar guiones al inicio y final

  return cleaned;
}

export async function checkPostUrl(
  title: string,
  currentPostId: string | undefined,
  context: KeystoneContext
): Promise<string> {
  let baseLink = sanitizeUrl(title);

  // Si después de limpiar queda vacío, usar un valor por defecto
  if (!baseLink || baseLink.length === 0) {
    baseLink = 'post';
  }

  let uniqueLink: string = baseLink;

  let existingPost = await context.db.Post.findOne({
    where: { url: uniqueLink },
  });

  if (existingPost && existingPost.id !== currentPostId) {
    let counter = 1;
    while (existingPost && existingPost.id !== currentPostId) {
      uniqueLink = `${baseLink}-${counter}`;
      existingPost = await context.db.Post.findOne({
        where: { url: uniqueLink },
      });
      counter++;
    }
  }

  return uniqueLink;
}

/**
 * Al marcar `published`, si el editor no puso una fecha manualmente se usa "ahora" (publicar
 * de inmediato). Si sí puso una fecha (pasada o futura), se respeta: así se programa un post
 * para publicarse después, sin que este hook la sobrescriba en cada guardado posterior.
 */
export const publishedAtHook = {
  resolveInput: async ({ resolvedData, item }: any) => {
    const isNewlyPublishing = resolvedData.published === true && item?.published !== true;
    // El campo `timestamp` del Admin UI manda `null` explícito cuando queda vacío (no omite
    // la llave), así que se trata igual que "no puesto".
    if (isNewlyPublishing && (resolvedData.publishedAt === undefined || resolvedData.publishedAt === null)) {
      resolvedData.publishedAt = new Date().toISOString();
    }
    return resolvedData;
  },
};

/**
 * Ventana de gracia para los efectos secundarios de "post publicado" (correo, Facebook): solo
 * se disparan si `publishedAt` venció hace menos de esto. Evita que, al agregar un flag nuevo
 * (nace en `null` para todo lo que ya existía), reabrir/editar un post viejo ya publicado —o el
 * cron de `publishScheduledPosts`— dispare un correo/post masivo para contenido de hace meses.
 * No requiere backfill de datos.
 */
const NOTIFY_GRACE_MS = 3 * 24 * 60 * 60 * 1000; // 3 días

function isRecentlyDue(publishedAt: string | Date | null | undefined): boolean {
  if (!publishedAt) return false;
  const publishedAtMs = new Date(publishedAt).getTime();
  const elapsedMs = Date.now() - publishedAtMs;
  return elapsedMs >= 0 && elapsedMs <= NOTIFY_GRACE_MS;
}

type NotifiablePost = {
  id: string;
  published?: boolean | null;
  publishedAt?: string | Date | null;
  publishedNotifiedAt?: string | Date | null;
  publishedToFacebookAt?: string | Date | null;
};

function isPendingNotification(post: NotifiablePost): boolean {
  if (post.published !== true || post.publishedNotifiedAt) return false;
  return isRecentlyDue(post.publishedAt);
}

/**
 * Manda el correo de "nuevo post" para `post` si le toca (ver `isPendingNotification`), y marca
 * `publishedNotifiedAt` para no reenviar. La usan tanto el hook de creación/edición como el
 * cron externo (`publishScheduledPosts`) — es la única fuente de verdad de "ya se notificó".
 */
export async function notifyNewPostIfDue(
  post: NotifiablePost,
  context: KeystoneContext,
): Promise<void> {
  if (!isPendingNotification(post)) return;

  try {
    // Se marca antes de intentar el envío para no reintentar (ni duplicar) en el próximo
    // guardado o corrida de cron si el envío falla a medio camino. `context.prisma` (no
    // `context.db`/`context.query`) porque estos sí vuelven a disparar `afterOperation` — con
    // dos flags independientes (correo y Facebook) eso puede procesar el otro flag con datos
    // viejos desde el código que sigue más abajo. `context.prisma` no pasa por los hooks.
    await context.sudo().prisma.post.update({
      where: { id: post.id },
      data: { publishedNotifiedAt: new Date() },
    });

    // Get full post data with relationships
    const fullPost = await context.sudo().query.Post.findOne({
      where: { id: post.id },
      query: `
        id
        title
        url
        excerpt
        product
        author {
          name
          lastName
        }
        category {
          name
        }
      `,
    });

    if (!fullPost) {
      return;
    }

    const postProduct = (fullPost.product || PRODUCT.PET) as Product;

    // Solo suscriptores activos del producto al que pertenece el post
    const subscriptions = await context.sudo().query.BlogSubscription.findMany({
      where: {
        active: {
          equals: true,
        },
        product: {
          in: subscriberProductsFor(postProduct),
        },
      },
      query: 'email product',
    });

    if (subscriptions.length === 0) {
      console.log('No active subscriptions found. Email not sent.');
      return;
    }

    const authorName = fullPost.author
      ? `${fullPost.author.name} ${fullPost.author.lastName || ''}`.trim()
      : null;

    // Un correo por producto: cada uno con su URL de front y su marca
    let sent = 0;
    for (const product of subscriberProductsFor(postProduct)) {
      const recipientEmails = subscriptions
        .filter((sub: any) => sub.product === product)
        .map((sub: any) => sub.email)
        .filter((email: string) => email && email.trim() !== '');

      if (recipientEmails.length === 0) {
        continue;
      }

      await sendNewPostEmail({
        postTitle: fullPost.title,
        postUrl: `${frontendUrlFor(product)}/blog/${fullPost.url || fullPost.id}`,
        postExcerpt: fullPost.excerpt,
        authorName,
        categoryName: categoryLabelFor(fullPost.category?.name),
        recipientEmails,
        brand: product === PRODUCT.SAAS ? 'saas' : 'pet',
        unsubscribeBaseUrl: `${frontendUrlFor(product)}/blog/desuscribirse`,
      });
      sent += recipientEmails.length;
    }

    if (sent === 0) {
      console.log('No valid email addresses found. Email not sent.');
      return;
    }

    console.log(`New post email sent to ${sent} subscribers`);
  } catch (error) {
    console.error('Error sending new post email:', error);
    // Don't throw error to prevent post creation from failing
  }
}

function isPendingFacebookPost(post: NotifiablePost): boolean {
  if (post.published !== true || post.publishedToFacebookAt) return false;
  return isRecentlyDue(post.publishedAt);
}

/** A qué Página(s) de Facebook le toca un post, según su `product`. `all` va a las dos. */
function facebookProductsFor(product: Product): Product[] {
  return product === PRODUCT.ALL ? [PRODUCT.PET, PRODUCT.SAAS] : [product];
}

/**
 * Publica `post` en la(s) Página(s) de Facebook que le tocan (ver `isPendingFacebookPost`), y
 * marca `publishedToFacebookAt` para no duplicar. Mismo trade-off que el correo: se marca antes
 * de intentar, así que un fallo (ej. token vencido) no reintenta solo — un admin puede vaciar
 * `publishedToFacebookAt` desde el Admin UI para forzar un reintento tras arreglar la causa.
 */
export async function publishPostToFacebookIfDue(
  post: NotifiablePost,
  context: KeystoneContext,
): Promise<void> {
  if (!isPendingFacebookPost(post)) return;

  try {
    // Ver el comentario equivalente en notifyNewPostIfDue: `context.prisma` evita que esta
    // escritura vuelva a disparar `afterOperation` (y con él, este mismo guard) en cascada.
    await context.sudo().prisma.post.update({
      where: { id: post.id },
      data: { publishedToFacebookAt: new Date() },
    });

    const fullPost = await context.sudo().query.Post.findOne({
      where: { id: post.id },
      query: `
        id
        title
        url
        excerpt
        product
      `,
    });

    if (!fullPost) {
      return;
    }

    const postProduct = (fullPost.product || PRODUCT.PET) as Product;
    const message = fullPost.excerpt
      ? `${fullPost.title}\n\n${fullPost.excerpt}`
      : fullPost.title;

    for (const product of facebookProductsFor(postProduct)) {
      const link = `${frontendUrlFor(product)}/blog/${fullPost.url || fullPost.id}`;
      try {
        const result = await postToFacebookPage({ product, message, link });
        if (result) {
          console.log(`[facebook] Post publicado en la Página de "${product}": ${result.id}`);
        }
      } catch (error) {
        // Un fallo en una Página (ej. token vencido) no debe impedir intentar la otra.
        console.error(`[facebook] Error publicando en la Página de "${product}":`, error);
      }
    }
  } catch (error) {
    console.error('[facebook] Error al preparar la publicación:', error);
    // Don't throw error to prevent post creation from failing
  }
}

/**
 * Hook: intenta el correo y la publicación en Facebook cada vez que un post se crea o se edita.
 * Cubre el caso normal (publicar de inmediato) y el caso en que alguien reabre y guarda un post
 * programado después de su fecha. El cron `publishScheduledPosts` cubre el caso en que nadie
 * vuelve a tocarlo.
 */
export const postPublishSideEffectsHook = {
  afterOperation: async ({
    operation,
    item,
    context,
  }: {
    operation: string;
    item: any;
    context: KeystoneContext;
  }) => {
    if (operation === 'create' || operation === 'update') {
      await notifyNewPostIfDue(item, context);
      await publishPostToFacebookIfDue(item, context);
    }
  },
};

