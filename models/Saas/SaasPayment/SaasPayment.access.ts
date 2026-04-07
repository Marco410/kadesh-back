import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;
const getUserId = (session: any) => session?.data?.id as string | undefined;

/** Pagos del usuario o de alguien de la misma empresa; admin ve todo. */
function paymentFilter(session: any) {
  if (hasRole(session, [Role.ADMIN])) {
    return true;
  }
  const userId = getUserId(session);
  if (!userId) return false;
  const companyId = getCompanyId(session);
  if (companyId) {
    return { user: { company: { id: { equals: companyId } } } };
  }
  return { user: { id: { equals: userId } } };
}

export const saasPaymentAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) =>
      hasRole(session, [Role.ADMIN]) || !!getUserId(session),
    update: () => true,
    delete: () => true,
  },
  filter: {
    query: ({ session }: any) => paymentFilter(session),
    update: ({ session }: any) => paymentFilter(session),
    delete: ({ session }: any) => paymentFilter(session),
  },
};
