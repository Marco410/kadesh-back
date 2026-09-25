import { ListAccessControl } from "@keystone-6/core/types";
import {
  getSessionCompanyId,
  getSessionUserId,
  isCompanyAdmin,
  isPlatformAdmin,
  isSignedIn,
} from "../../../../utils/access/tenant";

/**
 * - admin de plataforma: todo.
 * - admin_company: todos los eventos de su empresa.
 * - resto (vendedor, user_company): solo los que ellos son dueños (`createdBy`).
 */
export function calendarEventScopedWhere(
  session: any,
): true | false | Record<string, unknown> {
  if (isPlatformAdmin(session)) return true;
  const companyId = getSessionCompanyId(session);
  const userId = getSessionUserId(session);
  if (!companyId || !userId) return false;
  if (isCompanyAdmin(session)) {
    return { company: { id: { equals: companyId } } };
  }
  return {
    AND: [
      { company: { id: { equals: companyId } } },
      { createdBy: { id: { equals: userId } } },
    ],
  };
}

export const techCalendarEventAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: ({ session }: any) =>
      isPlatformAdmin(session) || !!getSessionCompanyId(session),
    update: ({ session }: any) => isSignedIn(session),
    delete: ({ session }: any) => isSignedIn(session),
  },
  filter: {
    query: ({ session }: any) => calendarEventScopedWhere(session),
    update: ({ session }: any) => calendarEventScopedWhere(session),
    delete: ({ session }: any) => calendarEventScopedWhere(session),
  },
};
