import { ListAccessControl } from "@keystone-6/core/types";
import {
  getSessionUserId,
  isPlatformAdmin,
} from "../../../utils/access/tenant";

/** Pagos: solo los del usuario, o admin de plataforma. */
function paymentFilter(session: any) {
  if (isPlatformAdmin(session)) {
    return true;
  }
  const userId = getSessionUserId(session);
  if (!userId) return false;
  return { user: { id: { equals: userId } } };
}

export const saasPaymentAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) =>
      isPlatformAdmin(session) || !!getSessionUserId(session),
    update: () => true,
    delete: () => true,
  },
  filter: {
    query: ({ session }: any) => paymentFilter(session),
    update: ({ session }: any) => paymentFilter(session),
    delete: ({ session }: any) => paymentFilter(session),
  },
};
