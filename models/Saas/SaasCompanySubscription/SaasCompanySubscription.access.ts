import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;

/**
 * Suscripciones: la empresa solo lee las suyas.
 * Crear/editar/borrar es solo del admin de plataforma; el backend escribe con `sudo()`
 * (alta de empresa, checkout, sync con Stripe). Si la empresa pudiera editarla,
 * cambiaría `planFeatures`/`planLeadLimit`/`status` sin pagar.
 */
export const saasCompanySubscriptionAccess: ListAccessControl<any> = {
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
