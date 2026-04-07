import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";

const getCompanyId = (session: any) => session?.data?.company?.id;
const getUserId = (session: any) => session?.data?.id as string | undefined;

/** Métodos de pago del usuario o de compañeros de empresa; admin ve todo. */
function paymentMethodFilter(session: any) {
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

export const saasPaymentMethodAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) =>
      hasRole(session, [Role.ADMIN]) || !!getUserId(session),
    update: () => true,
    delete: () => true,
  },
  filter: {
    query: ({ session }: any) => paymentMethodFilter(session),
    update: ({ session }: any) => paymentMethodFilter(session),
    delete: ({ session }: any) => paymentMethodFilter(session),
  },
};
