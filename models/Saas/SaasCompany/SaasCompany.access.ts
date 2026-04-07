import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;

/**
 * Empresas (tenants): el usuario solo ve y edita la suya (session.company).
 * Crear / borrar empresas: solo rol admin (alta de tenant y baja global).
 */
export const saasCompanyAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) => hasRole(session, [Role.ADMIN]),
    update: () => true,
    delete: ({ session }: any) => hasRole(session, [Role.ADMIN]),
  },
  filter: {
    query: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { id: { equals: companyId } };
    },
    update: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { id: { equals: companyId } };
    },
    delete: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      return false;
    },
  },
};
