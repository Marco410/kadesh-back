import { ListAccessControl } from "@keystone-6/core/types";
import { isPlatformAdmin, isSignedIn } from "../../../../utils/access/tenant";
import { googleCalendarAccountVisibleWhere } from "../../GoogleCalendarAccount/GoogleCalendarAccount.access";

/**
 * Historial de llamadas a Google: lectura acotada a las cuentas visibles para la sesión.
 * Altas solo vía sudo (persistGoogleCalendarSyncLog). Borrado solo admin de plataforma.
 */
export const techGoogleCalendarSyncLogAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: () => false,
    update: () => false,
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
  filter: {
    query: ({ session }: any) => {
      const where = googleCalendarAccountVisibleWhere(session);
      if (where === true || where === false) return where;
      return { account: where };
    },
    update: () => false,
    delete: ({ session }: any) => (isPlatformAdmin(session) ? true : false),
  },
};
