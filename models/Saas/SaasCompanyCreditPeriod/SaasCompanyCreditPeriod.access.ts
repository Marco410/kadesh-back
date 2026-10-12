import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;

/**
 * Periodo mensual de créditos (cupo y gasto): la empresa solo lee el suyo.
 * Solo se escribe desde `utils/saas/companyCredits.ts` (con `sudo()`/Prisma) o por admin de plataforma.
 */
export const companyCreditPeriodAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) => hasRole(session, [Role.ADMIN]),
    update: ({ session }: any) => hasRole(session, [Role.ADMIN]),
    delete: ({ session }: any) => hasRole(session, [Role.ADMIN]),
  },
  filter: {
    query: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) return true;
      const companyId = getCompanyId(session);
      if (!companyId) return false;
      return { company: { id: { equals: companyId } } };
    },
    update: ({ session }: any) => hasRole(session, [Role.ADMIN]),
    delete: ({ session }: any) => hasRole(session, [Role.ADMIN]),
  },
};
