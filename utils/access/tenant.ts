import { hasRole } from "../../auth/permissions";
import { Role } from "../../models/Role/constants";

export type SessionLike = {
  data?: {
    id?: string;
    company?: { id?: string } | null;
  };
} | null | undefined;

export function getSessionUserId(session: SessionLike): string | null {
  return session?.data?.id ?? null;
}

export function getSessionCompanyId(session: SessionLike): string | null {
  return session?.data?.company?.id ?? null;
}

export function isSignedIn(session: SessionLike): boolean {
  return !!getSessionUserId(session);
}

export function isPlatformAdmin(session: SessionLike): boolean {
  return hasRole(session, [Role.ADMIN]);
}

export function isCompanyAdmin(session: SessionLike): boolean {
  return hasRole(session, [Role.ADMIN_COMPANY]);
}

/**
 * Empresa sobre la que el caller puede operar.
 * Admin de plataforma puede pasar un companyId; el resto solo la de su sesión.
 */
export function resolveAuthorizedCompanyId(
  session: SessionLike,
  requestedCompanyId?: string | null,
): string | null {
  if (!isSignedIn(session)) return null;
  if (isPlatformAdmin(session)) {
    const requested = requestedCompanyId?.trim();
    return requested || getSessionCompanyId(session);
  }
  const sessionCompanyId = getSessionCompanyId(session);
  if (!sessionCompanyId) return null;
  if (requestedCompanyId && requestedCompanyId !== sessionCompanyId) {
    return null;
  }
  return sessionCompanyId;
}

export function denyOtherCompanyMessage(): string {
  return "No puedes acceder a datos de otra empresa";
}
