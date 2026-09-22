import { PRODUCT } from "../../../utils/constants/product";

const typeDefs = `
  type UnsubscribeBlogResult {
    success: Boolean!
    message: String!
  }

  type Mutation {
    unsubscribeBlog(email: String!, product: String!): UnsubscribeBlogResult!
  }
`;

const definition = `
  unsubscribeBlog(email: String!, product: String!): UnsubscribeBlogResult!
`;

const resolver = {
  /**
   * Desactiva (`active: false`) la suscripción al blog de un producto. Cada front manda su
   * propio `product`, así que quien se da de baja del blog de Pet sigue en el de SaaS.
   * Es idempotente: darse de baja dos veces no falla.
   */
  unsubscribeBlog: async (
    _root: unknown,
    { email, product }: { email: string; product: string },
    context: any,
  ) => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      return { success: false, message: "El correo es obligatorio." };
    }
    if (product !== PRODUCT.PET && product !== PRODUCT.SAAS) {
      return { success: false, message: "Producto no válido." };
    }

    try {
      const subscriptions = await context.sudo().db.BlogSubscription.findMany({
        where: {
          email: { equals: normalizedEmail },
          product: { equals: product },
        },
      });

      if (subscriptions.length === 0) {
        return {
          success: false,
          message: "No encontramos una suscripción con este correo.",
        };
      }

      const active = subscriptions.filter((sub: any) => sub.active);
      if (active.length > 0) {
        await context.sudo().db.BlogSubscription.updateMany({
          data: active.map((sub: any) => ({
            where: { id: sub.id },
            data: { active: false },
          })),
        });
      }

      return {
        success: true,
        message: "Tu suscripción fue cancelada. Ya no recibirás notificaciones del blog.",
      };
    } catch (error) {
      console.error("Error al cancelar suscripción al blog:", error);
      return {
        success: false,
        message: "No pudimos cancelar tu suscripción. Intenta de nuevo más tarde.",
      };
    }
  },
};

export default { typeDefs, definition, resolver };
