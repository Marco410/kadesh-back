import { ListAccessControl } from "@keystone-6/core/types";
import {
  getSessionUserId,
  isPlatformAdmin,
} from "../../../utils/access/tenant";

/** Métodos de pago: solo los del usuario, o admin de plataforma. */
function paymentMethodFilter(session: any) {
  if (isPlatformAdmin(session)) {
    return true;
  }
  const userId = getSessionUserId(session);
  if (!userId) return false;
  return { user: { id: { equals: userId } } };
}

export const saasPaymentMethodAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) =>
      isPlatformAdmin(session) || !!getSessionUserId(session),
    update: () => true,
    delete: () => true,
  },
  filter: {
    query: ({ session }: any) => paymentMethodFilter(session),
    update: ({ session }: any) => paymentMethodFilter(session),
    delete: ({ session }: any) => paymentMethodFilter(session),
  },
};
