import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;

/**
 * Historial de llamadas a IA: lectura acotada a la empresa de la sesión.
 * Altas solo vía sudo desde callCompanyAi.
 */
export const techAiCallLogAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: () => false,
    update: () => false,
    delete: () => true,
  },
  filter: {
    query: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: () => false,
    delete: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
  },
};
