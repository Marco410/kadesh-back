import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId } from "../../../../utils/access/tenant";

const typeDefs = `
  type Mutation {
    markAllNotificationsRead(product: String): Int!
  }
`;

const definition = `
  markAllNotificationsRead(product: String): Int!
`;

const resolver = {
  /**
   * Marca como leídas todas las notificaciones no leídas de quien tiene la sesión (opcionalmente
   * solo las de un producto: "pet" | "saas"). Devuelve cuántas cambió. Marcar una sola se hace
   * con el `updateNotification` generado (solo permite `readAt`).
   */
  markAllNotificationsRead: async (
    _root: unknown,
    { product }: { product?: string | null },
    context: KeystoneContext,
  ): Promise<number> => {
    const userId = getSessionUserId(context.session as any);
    if (!userId) throw new Error("Inicia sesión para ver tus notificaciones.");
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    const result = await prisma.notification.updateMany({
      where: {
        recipientId: userId,
        readAt: null,
        ...(product ? { product } : {}),
      },
      data: { readAt: new Date() },
    });
    if (result instanceof Error) throw result;
    return result?.count ?? 0;
  },
};

export default { typeDefs, definition, resolver };
