import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;

/**
 * Uso mensual de sync de leads (legacy): la empresa solo lee sus registros.
 * Crear/editar/borrar solo admin de plataforma.
 */
export const saasCompanyMonthlyLeadSyncAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) => hasRole(session, [Role.ADMIN]),
    update: ({ session }: any) => hasRole(session, [Role.ADMIN]),
    delete: ({ session }: any) => hasRole(session, [Role.ADMIN]),
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
    update: ({ session }: any) => hasRole(session, [Role.ADMIN]),
    delete: ({ session }: any) => hasRole(session, [Role.ADMIN]),
  },
};
