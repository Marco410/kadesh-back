import { ListAccessControl } from "@keystone-6/core/types";
import {
  getSessionCompanyId,
  getSessionUserId,
  isPlatformAdmin,
  isSignedIn,
} from "../../../utils/access/tenant";

/**
 * Cuentas de Google visibles para la sesión: las personales propias + las compartidas
 * de su empresa. Se reutiliza (con prefijo `account`) en las listas hijas.
 */
export function googleCalendarAccountVisibleWhere(
  session: any,
): true | false | Record<string, unknown> {
  if (isPlatformAdmin(session)) return true;
  const userId = getSessionUserId(session);
  const companyId = getSessionCompanyId(session);
  const or: Record<string, unknown>[] = [];
  if (userId) or.push({ user: { id: { equals: userId } } });
  if (companyId) or.push({ company: { id: { equals: companyId } } });
  if (or.length === 0) return false;
  return { OR: or };
}

/**
 * Las cuentas solo se crean/borran/actualizan vía mutaciones custom (connect / disconnect /
 * refresh) con `context.sudo()`, porque manejan tokens. Por la API genérica solo se lee.
 */
export const googleCalendarAccountAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  filter: {
    query: ({ session }: any) => googleCalendarAccountVisibleWhere(session),
  },
};
