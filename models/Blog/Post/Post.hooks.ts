import { KeystoneContext } from "@keystone-6/core/types";
import { sendNewPostEmail } from "../../../utils/helpers/sendgrid";
import { PRODUCT, type Product } from "../../../utils/constants/product";

/** Suscriptores que reciben un post: los de su producto, o los dos si el post es `all`. */
function subscriberProductsFor(product: Product): string[] {
  return product === PRODUCT.ALL ? [PRODUCT.PET, PRODUCT.SAAS] : [product];
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

export const publishedAtHook = {
  resolveInput: async ({ resolvedData, item, operation }: any) => {
    if (resolvedData.published === true) {
      resolvedData.publishedAt = new Date().toISOString();
    }
    return resolvedData;
  },
};

/**
 * Hook to send email notification when a new post is created
 */
export const newPostEmailHook = {
  afterOperation: async ({
    operation,
    item,
    context,
  }: {
    operation: string;
    item: any;
    context: KeystoneContext;
  }) => {
    // Only send email when a new post is created and published
    if (operation === 'create' && item?.published === true) {
      try {
        // Get full post data with relationships
        const post = await context.sudo().query.Post.findOne({
          where: { id: item.id },
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

        if (!post) {
          return;
        }

        const postProduct = (post.product || PRODUCT.PET) as Product;

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

        const authorName = post.author
          ? `${post.author.name} ${post.author.lastName || ''}`.trim()
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
            postTitle: post.title,
            postUrl: `${frontendUrlFor(product)}/blog/${post.url || post.id}`,
            postExcerpt: post.excerpt,
            authorName,
            categoryName: post.category?.name || null,
            recipientEmails,
            brand: product === PRODUCT.SAAS ? 'saas' : 'pet',
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
  },
};

