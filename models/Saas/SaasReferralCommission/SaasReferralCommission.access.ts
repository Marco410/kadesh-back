import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;
const getUserId = (session: any) => session?.data?.id as string | undefined;

/**
 * Comisiones: empresa (suscripción), referidor o usuario referido.
 * Admin ve todo.
 */
function referralCommissionFilter(session: any) {
  if (hasRole(session, [Role.ADMIN])) {
    return true;
  }
  const userId = getUserId(session);
  if (!userId) return false;
  const companyId = getCompanyId(session);
  const orClause: Record<string, unknown>[] = [
    { referrer: { id: { equals: userId } } },
    { referredUser: { id: { equals: userId } } },
  ];
  if (companyId) {
    orClause.push({ company: { id: { equals: companyId } } });
  }
  return { OR: orClause };
}

export const saasReferralCommissionAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    /** Las comisiones las genera el backend; solo admin crea/edita desde Admin si hace falta */
    create: ({ session }: any) => hasRole(session, [Role.ADMIN]),
    update: () => true,
    delete: ({ session }: any) => hasRole(session, [Role.ADMIN]),
  },
  filter: {
    query: ({ session }: any) => referralCommissionFilter(session),
    update: ({ session }: any) => referralCommissionFilter(session),
    delete: ({ session }: any) => {
      if (hasRole(session, [Role.ADMIN])) {
        return true;
      }
      return false;
    },
  },
};
