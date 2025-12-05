import { KeystoneContext } from "@keystone-6/core/types";

function sanitizeUrl(text: string): string {
  // Eliminar emojis y caracteres especiales
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{2934}\u{2935}]|[\u{2190}-\u{21FF}]/gu;
  
  let cleaned = text
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

export const categoryUrlHook = {
  resolveInput: async ({ resolvedData, item, context }: any) => {
    if (item && !resolvedData.name) {
      return item.url;
    }

    if (resolvedData.name) {
      return checkCategoryUrl(resolvedData.name, item?.id, context);
    }

    return item?.url || null;
  },
};

export async function checkCategoryUrl(
  name: string,
  currentCategoryId: string | undefined,
  context: KeystoneContext
): Promise<string> {
  let baseLink = sanitizeUrl(name);

  // Si después de limpiar queda vacío, usar un valor por defecto
  if (!baseLink || baseLink.length === 0) {
    baseLink = 'category';
  }

  let uniqueLink: string = baseLink;

  let existingCategory = await context.db.Category.findOne({
    where: { url: uniqueLink },
  });

  if (existingCategory && existingCategory.id !== currentCategoryId) {
    let counter = 1;
    while (existingCategory && existingCategory.id !== currentCategoryId) {
      uniqueLink = `${baseLink}-${counter}`;
      existingCategory = await context.db.Category.findOne({
        where: { url: uniqueLink },
      });
      counter++;
    }
  }

  return uniqueLink;
}

