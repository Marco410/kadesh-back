import { GoogleCalendarScopeType } from "../../../utils/googleCalendar/constants";

/**
 * Una cuenta es personal (con `user`) o compartida (con `company`), nunca ambas.
 * Corre también en creaciones vía sudo desde connectGoogleCalendarAccount.
 */
export const googleCalendarAccountHooks = {
  validateInput: async ({
    operation,
    resolvedData,
    addValidationError,
  }: any) => {
    if (operation !== "create") return;
    const hasUser = !!resolvedData?.user?.connect;
    const hasCompany = !!resolvedData?.company?.connect;

    if (resolvedData?.scopeType === GoogleCalendarScopeType.PERSONAL) {
      if (!hasUser || hasCompany) {
        addValidationError("Una cuenta personal debe tener usuario y no empresa");
      }
    } else if (resolvedData?.scopeType === GoogleCalendarScopeType.COMPANY) {
      if (!hasCompany || hasUser) {
        addValidationError("Una cuenta compartida debe tener empresa y no usuario");
      }
    }
  },
};
