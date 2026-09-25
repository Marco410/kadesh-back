import { hasRole } from "../../../../auth/permissions";
import { Role } from "../../../../models/Role/constants";
import {
  getSessionCompanyId,
  getSessionUserId,
  isPlatformAdmin,
  isSignedIn,
  type SessionLike,
} from "../../../../utils/access/tenant";
import { GoogleCalendarScopeType } from "../../../../utils/googleCalendar/constants";

export type GoogleAccountScope = {
  scopeType?: string | null;
  user?: { id: string; company?: { id: string } | null } | null;
  company?: { id: string } | null;
};

/** Query GraphQL para cargar lo que estas funciones necesitan de una cuenta. */
export const ACCOUNT_SCOPE_QUERY =
  "scopeType user { id company { id } } company { id }";

/** Empresa a la que pertenece una cuenta (compartida: la suya; personal: la de su dueño). */
export function accountCompanyId(account: GoogleAccountScope): string | null {
  return account.company?.id ?? account.user?.company?.id ?? null;
}

/**
 * Conectar una cuenta nueva:
 * - personal: cualquier usuario con empresa (conecta la suya).
 * - compartida: admin_company de esa empresa, o admin de plataforma.
 */
export function canConnectGoogleCalendar(
  session: SessionLike,
  scopeType: string,
  companyId: string,
): boolean {
  if (!isSignedIn(session)) return false;
  if (isPlatformAdmin(session)) return true;
  if (getSessionCompanyId(session) !== companyId) return false;
  if (scopeType === GoogleCalendarScopeType.COMPANY) {
    return hasRole(session, [Role.ADMIN_COMPANY]);
  }
  return scopeType === GoogleCalendarScopeType.PERSONAL;
}

/** Administrar (refrescar lista, elegir calendarios, desconectar) una cuenta existente. */
export function canManageGoogleCalendarAccount(
  session: SessionLike,
  account: GoogleAccountScope,
): boolean {
  if (!isSignedIn(session)) return false;
  if (isPlatformAdmin(session)) return true;
  if (account.scopeType === GoogleCalendarScopeType.PERSONAL) {
    return !!account.user?.id && account.user.id === getSessionUserId(session);
  }
  return (
    !!account.company?.id &&
    account.company.id === getSessionCompanyId(session) &&
    hasRole(session, [Role.ADMIN_COMPANY])
  );
}

/** Ver los eventos de una cuenta: su dueño (personal) o cualquier miembro de la empresa (compartida). */
export function canViewGoogleCalendarAccount(
  session: SessionLike,
  account: GoogleAccountScope,
): boolean {
  if (!isSignedIn(session)) return false;
  if (isPlatformAdmin(session)) return true;
  if (account.scopeType === GoogleCalendarScopeType.PERSONAL) {
    return !!account.user?.id && account.user.id === getSessionUserId(session);
  }
  return !!account.company?.id && account.company.id === getSessionCompanyId(session);
}

export function denyGoogleCalendarAccessMessage(session: SessionLike): string {
  if (!session?.data?.id) return "Debes iniciar sesión para usar Google Calendar";
  return "No tienes permiso para administrar esta cuenta de Google Calendar";
}
