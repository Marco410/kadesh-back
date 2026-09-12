import { hasRole } from "../../../../auth/permissions";
import { Role } from "../../../../models/Role/constants";
import {
  getSessionCompanyId,
  isPlatformAdmin,
  isSignedIn,
  type SessionLike,
} from "../../../../utils/access/tenant";

export { getSessionCompanyId };

/**
 * Configurar IA de una empresa: admin_company de esa empresa, o admin de plataforma.
 */
export function canManageCompanyAi(
  session: SessionLike,
  companyId: string,
): boolean {
  if (!isSignedIn(session)) return false;
  if (isPlatformAdmin(session)) return true;
  if (!hasRole(session, [Role.ADMIN_COMPANY])) return false;
  return getSessionCompanyId(session) === companyId;
}

/**
 * Usar IA ya configurada (digest, etc.): cualquier miembro de la empresa, o admin de plataforma.
 */
export function canUseCompanyAi(
  session: SessionLike,
  companyId: string,
): boolean {
  if (!isSignedIn(session)) return false;
  if (isPlatformAdmin(session)) return true;
  return getSessionCompanyId(session) === companyId;
}

export function denyCompanyAiAccessMessage(
  session: SessionLike,
): string {
  if (!session?.data?.id) {
    return "Debes iniciar sesión para configurar la IA";
  }
  return "Solo el administrador de la empresa puede configurar la IA";
}

export function denyCompanyAiUseMessage(session: SessionLike): string {
  if (!session?.data?.id) {
    return "Debes iniciar sesión para usar la IA";
  }
  return "Esta IA pertenece a otra empresa";
}
