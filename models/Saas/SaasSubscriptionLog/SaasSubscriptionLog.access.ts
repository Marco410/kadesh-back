import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: { data?: { company?: { id?: string } } }) =>
  session?.data?.company?.id;

/**
 * Logs de creación de suscripción: visibles para admin o para la empresa del usuario.
 */
export const saasSubscriptionLogAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: () => false,
    update: () => false,
    delete: () => true,
  },
  filter: {
    query: ({ session }) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      const companyId = getCompanyId(session as { data?: { company?: { id?: string } } });
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: () => false,
    delete: ({ session }) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      const companyId = getCompanyId(session as { data?: { company?: { id?: string } } });
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
  },
};
