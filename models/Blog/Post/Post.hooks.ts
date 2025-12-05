import { KeystoneContext } from "@keystone-6/core/types";

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

