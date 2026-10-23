import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import { Role } from "../../../../models/Role/constants";
import { getSessionUserId } from "../../../../utils/access/tenant";
import { anonymizeUserData } from "../../../../utils/account/anonymizeUser";
import { logActivity } from "../../../../utils/activity/logActivity";

/** Palabra que la persona escribe para confirmar (la app la pide tal cual). */
export const DELETE_ACCOUNT_CONFIRMATION = "ELIMINAR";

const typeDefs = `
  type DeleteMyAccountResult {
    success: Boolean!
    message: String!
  }

  type Mutation {
    deleteMyAccount(confirm: String!): DeleteMyAccountResult!
  }
`;

const definition = `
  deleteMyAccount(confirm: String!): DeleteMyAccountResult!
`;

const result = (success: boolean, message: string) => ({ success, message });

const resolver = {
  /**
   * Borra la cuenta de quien tiene la sesión (lo exigen App Store y Google Play): misma
   * anonimización que el ARCO de Operaciones. No aplica al equipo de Kadesh ni a cuentas de una
   * empresa de Kadesh Negocios (eso lo resuelve quien administra la empresa o Kadesh).
   */
  deleteMyAccount: async (
    _root: unknown,
    { confirm }: { confirm: string },
    context: KeystoneContext,
  ) => {
    const userId = getSessionUserId(context.session as any);
    if (!userId) return result(false, "Inicia sesión para borrar tu cuenta.");
    if (confirm.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRMATION) {
      return result(false, `Escribe ${DELETE_ACCOUNT_CONFIRMATION} para confirmar.`);
    }

    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        lastName: true,
        secondLastName: true,
        email: true,
        companyId: true,
        anonymizedAt: true,
        roles: { select: { name: true } },
      },
    });
    if (!user || user instanceof Error) return result(false, "No se encontró tu cuenta.");
    if (user.anonymizedAt) return result(false, "Esta cuenta ya fue eliminada.");
    if ((user.roles ?? []).some((role: { name: string }) => role.name === Role.ADMIN)) {
      return result(false, "Las cuentas del equipo de Kadesh se dan de baja desde Operaciones.");
    }
    if (user.companyId) {
      return result(
        false,
        "Tu cuenta pertenece a una empresa en Kadesh Negocios. Pide a quien la administra que te dé de baja o escríbenos desde Contacto.",
      );
    }

    await anonymizeUserData(context, user);

    void logActivity(context, {
      type: ACTIVITY_EVENT.AUTH_ACCOUNT_DELETED,
      companyId: null,
      entityType: "User",
      entityId: userId,
      summary: "Borró su cuenta desde la app",
    });
    return result(true, "Tu cuenta fue eliminada. Gracias por ayudar a las mascotas.");
  },
};

export default { typeDefs, definition, resolver };
