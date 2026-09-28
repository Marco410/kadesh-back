import { PRODUCT } from "../../../utils/constants/product";

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * `email` ya no es único: la misma persona puede seguir el blog de Pet y el del SaaS.
 * La unicidad es por (email, product) y se valida aquí porque Keystone no tiene índice compuesto.
 *
 * El email se normaliza a minúsculas: sin eso, `Anaom@x` y `anaom@x` eran dos filas y pausar
 * una dejaba la otra activa (seguía llegando el correo de nuevo post).
 */
export const blogSubscriptionHooks = {
  resolveInput: async ({ resolvedData }: any) => {
    if (typeof resolvedData.email === "string") {
      resolvedData.email = normalizeEmail(resolvedData.email);
    }
    return resolvedData;
  },

  validateInput: async ({
    operation,
    resolvedData,
    item,
    context,
    addValidationError,
  }: any) => {
    const email = normalizeEmail(resolvedData.email ?? item?.email);
    const product: string = resolvedData.product ?? item?.product ?? PRODUCT.PET;

    if (!email) return;
    if (
      operation === "update" &&
      resolvedData.email === undefined &&
      resolvedData.product === undefined
    ) {
      return;
    }

    const existing = await context.sudo().query.BlogSubscription.findMany({
      where: {
        email: { equals: email, mode: "insensitive" },
        product: { equals: product },
      },
      take: 2,
      query: "id",
    });

    const conflict = existing.find((row: { id: string }) => row.id !== item?.id);
    if (conflict) {
      addValidationError("Este correo ya está suscrito al blog.");
    }
  },

  /**
   * Si se pausa una fila, apaga también duplicados del mismo (email, product) con distinto
   * casing (datos viejos). Usa Prisma directo para no re-disparar este hook en cascada.
   */
  afterOperation: async ({
    operation,
    item,
    originalItem,
    context,
  }: any) => {
    if (operation !== "create" && operation !== "update") return;
    if (!item || item.active !== false) return;
    if (operation === "update" && originalItem?.active === false) return;

    const email = normalizeEmail(item.email);
    const product = item.product ?? PRODUCT.PET;
    if (!email) return;

    await context.sudo().prisma.blogSubscription.updateMany({
      where: {
        id: { not: item.id },
        product,
        active: true,
        email: { equals: email, mode: "insensitive" },
      },
      data: { active: false },
    });
  },
};
