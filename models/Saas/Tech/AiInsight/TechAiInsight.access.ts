import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../../auth/permissions";
import { Role } from "../../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;

/**
 * Insights de IA: lectura acotada a la empresa de la sesión.
 * Altas y ediciones solo vía sudo desde las mutaciones de IA.
 */
export const techAiInsightAccess: ListAccessControl<any> = {
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
