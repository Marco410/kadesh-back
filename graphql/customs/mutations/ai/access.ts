import { hasPermission, hasRole } from "../../../../auth/permissions";
import { PERMISSION_KEYS } from "../../../../auth/permissionsCatalog";
import { Role } from "../../../../models/Role/constants";
import {
  getSessionCompanyId,
  isPlatformAdmin,
  isSignedIn,
  type SessionLike,
} from "../../../../utils/access/tenant";

export { getSessionCompanyId };

/**
 * Configurar IA de una empresa: permiso `ai.configurar`, admin_company legado,
 * o admin de plataforma.
 */
export function canManageCompanyAi(
  session: SessionLike,
  companyId: string,
): boolean {
  if (!isSignedIn(session)) return false;
  if (isPlatformAdmin(session)) return true;
  if (getSessionCompanyId(session) !== companyId) return false;
  return hasPermission(session, PERMISSION_KEYS.AI_CONFIGURAR, () =>
    hasRole(session, [Role.ADMIN_COMPANY]),
  );
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
  if (!getSessionCompanyId(session)) {
    return "Tu cuenta no tiene una empresa asociada";
  }
  return "No tienes permiso para configurar la IA de la empresa";
}

export function denyCompanyAiUseMessage(session: SessionLike): string {
  if (!session?.data?.id) {
    return "Debes iniciar sesión para usar la IA";
  }
  return "Esta IA pertenece a otra empresa";
}
