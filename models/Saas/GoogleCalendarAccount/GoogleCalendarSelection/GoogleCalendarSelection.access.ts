import { ListAccessControl } from "@keystone-6/core/types";
import { isSignedIn } from "../../../../utils/access/tenant";
import { googleCalendarAccountVisibleWhere } from "../GoogleCalendarAccount.access";

/**
 * Lectura acotada a las cuentas visibles para la sesión. Cambiar `isSelected` se hace con
 * toggleGoogleCalendarSelection (valida quién puede administrar la cuenta), no por aquí.
 */
export const googleCalendarSelectionAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  filter: {
    query: ({ session }: any) => {
      const where = googleCalendarAccountVisibleWhere(session);
      if (where === true || where === false) return where;
      return { account: where };
    },
  },
};
