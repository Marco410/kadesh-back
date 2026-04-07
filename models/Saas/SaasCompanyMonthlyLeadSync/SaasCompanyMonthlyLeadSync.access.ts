import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;

/**
 * Uso mensual de sync de leads: solo registros de la SaasCompany del usuario.
 * Rol admin: acceso total.
 */
export const saasCompanyMonthlyLeadSyncAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) =>
      hasRole(session, [Role.ADMIN]) || !!getCompanyId(session),
    update: () => true,
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
    update: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
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
