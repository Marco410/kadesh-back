import { ListAccessControl } from "@keystone-6/core/types";
import {
  getSessionCompanyId,
  isCompanyAdmin,
  isPlatformAdmin,
  isSignedIn,
} from "../../../../utils/access/tenant";

/**
 * Historial de llamadas a IA: lectura acotada a la empresa de la sesión.
 * Altas solo vía sudo desde callCompanyAi. Borrado solo admin de plataforma.
 */
export const techAiCallLogAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: () => false,
    update: () => false,
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
  filter: {
    query: ({ session }: any) => {
      if (isPlatformAdmin(session)) {
        return true;
      }
      const companyId = getSessionCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: () => false,
    delete: ({ session }: any) => (isPlatformAdmin(session) ? true : false),
  },
};

/** Prompts y respuestas: solo admin de plataforma o admin de la empresa. */
export const aiCallLogPromptFieldAccess = {
  read: ({ session }: any) =>
    isPlatformAdmin(session) || isCompanyAdmin(session),
  create: () => false,
  update: () => false,
};
