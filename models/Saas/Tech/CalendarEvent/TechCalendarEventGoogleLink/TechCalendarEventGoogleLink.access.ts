import { ListAccessControl } from "@keystone-6/core/types";
import { isSignedIn } from "../../../../../utils/access/tenant";
import { calendarEventScopedWhere } from "../TechCalendarEvent.access";

/** Solo lectura, con el mismo alcance que el evento. Se escribe desde sync.ts vía sudo. */
export const techCalendarEventGoogleLinkAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  filter: {
    query: ({ session }: any) => {
      const where = calendarEventScopedWhere(session);
      if (where === true || where === false) return where;
      return { event: where };
    },
  },
};
