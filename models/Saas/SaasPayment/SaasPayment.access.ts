import { ListAccessControl } from "@keystone-6/core/types";
import {
  getSessionUserId,
  isPlatformAdmin,
} from "../../../utils/access/tenant";

/**
 * Pagos: el usuario solo lee los suyos; admin de plataforma ve todos.
 * Los cobros los registra el backend (`createCompanySubscription`, `purchaseCredits`) con `sudo()`;
 * por API solo el admin crea/edita/borra, para que nadie altere su historial de cobros.
 */
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
    create: ({ session }: any) => isPlatformAdmin(session),
    update: ({ session }: any) => isPlatformAdmin(session),
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
  filter: {
    query: ({ session }: any) => paymentFilter(session),
    update: ({ session }: any) => isPlatformAdmin(session),
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
};
