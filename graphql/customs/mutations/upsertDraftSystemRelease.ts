import { PRODUCT, type Product } from "../../../utils/constants/product";

const typeDefs = `
  type UpsertDraftSystemReleaseResult {
    success: Boolean!
    message: String!
    releaseId: ID
  }

  type Mutation {
    upsertDraftSystemRelease(secret: String!, product: String!, entry: String!): UpsertDraftSystemReleaseResult!
  }
`;

const definition = `
  upsertDraftSystemRelease(secret: String!, product: String!, entry: String!): UpsertDraftSystemReleaseResult!
`;

const ALLOWED_PRODUCTS: Product[] = [PRODUCT.PET, PRODUCT.SAAS];
const MAX_ENTRY_LENGTH = 300;

function todayPlaceholderVersion(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Borrador ${today}`;
}

const resolver = {
  /**
   * Pensada para el CI de kadesh-landing / kadesh-business (GitHub Actions en esos repos,
   * no en este), no para un usuario logueado: se autoriza con `SYSTEM_RELEASE_SECRET`, no con
   * sesión/rol. Cada push a main de esos repos manda una línea (el mensaje del commit, ya en
   * lenguaje natural) que se agrega al borrador de novedades sin publicar más reciente de ese
   * producto, o crea uno nuevo si no hay ninguno. Nunca marca `isPublished: true` — eso lo hace
   * un admin a mano desde el admin de Keystone, editando también `version` antes de publicar.
   */
  upsertDraftSystemRelease: async (
    _root: unknown,
    { secret, product, entry }: { secret: string; product: string; entry: string },
    context: any,
  ) => {
    const expected = process.env.SYSTEM_RELEASE_SECRET?.trim();
    if (!expected || secret !== expected) {
      return { success: false, message: "No autorizado.", releaseId: null };
    }

    if (!ALLOWED_PRODUCTS.includes(product as Product)) {
      return {
        success: false,
        message: `Producto inválido: ${product}.`,
        releaseId: null,
      };
    }

    const cleanEntry = entry.trim().slice(0, MAX_ENTRY_LENGTH);
    if (!cleanEntry) {
      return { success: false, message: "La novedad viene vacía.", releaseId: null };
    }

    try {
      const [draft] = await context.sudo().db.SystemRelease.findMany({
        where: { product: { equals: product }, isPublished: { equals: false } },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
      });

      if (draft) {
        const body = draft.body ? `${draft.body}\n- ${cleanEntry}` : `- ${cleanEntry}`;
        const updated = await context.sudo().db.SystemRelease.updateOne({
          where: { id: draft.id },
          data: { body },
        });

        return {
          success: true,
          message: "Novedad agregada al borrador existente.",
          releaseId: updated.id,
        };
      }

      const created = await context.sudo().db.SystemRelease.createOne({
        data: {
          product,
          version: todayPlaceholderVersion(),
          body: `- ${cleanEntry}`,
          releasedAt: new Date().toISOString(),
          isPublished: false,
        },
      });

      return {
        success: true,
        message: "Borrador de novedades creado.",
        releaseId: created.id,
      };
    } catch (error) {
      console.error("Error en upsertDraftSystemRelease:", error);
      return {
        success: false,
        message: "Error al guardar la novedad.",
        releaseId: null,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
