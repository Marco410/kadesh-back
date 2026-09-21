import { PRODUCT } from "../../../utils/constants/product";

/**
 * `email` ya no es único: la misma persona puede seguir el blog de Pet y el del SaaS.
 * La unicidad es por (email, product) y se valida aquí porque Keystone no tiene índice compuesto.
 */
export const blogSubscriptionHooks = {
  validateInput: async ({
    operation,
    resolvedData,
    item,
    context,
    addValidationError,
  }: any) => {
    const email: string | undefined = resolvedData.email ?? item?.email;
    const product: string = resolvedData.product ?? item?.product ?? PRODUCT.PET;

    if (!email) return;
    if (operation === "update" && resolvedData.email === undefined && resolvedData.product === undefined) {
      return;
    }

    const existing = await context.sudo().db.BlogSubscription.findMany({
      where: { email: { equals: email }, product: { equals: product } },
      take: 1,
    });

    if (existing.length > 0 && existing[0].id !== item?.id) {
      addValidationError("Este correo ya está suscrito al blog.");
    }
  },
};
