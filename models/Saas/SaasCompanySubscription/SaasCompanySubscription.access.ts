import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;

/**
 * Suscripciones: solo las de la SaasCompany del usuario (sesión).
 * Rol admin: acceso total. Crear en Admin solo con empresa asignada o como admin.
 */
export const saasCompanySubscriptionAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) => !!getCompanyId(session),
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
