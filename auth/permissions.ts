// -------- MAIN AUTH VALIDATIONS

import { Role } from "../models/Role/constants";

function sessionRoleNames(session: any): string[] {
  const names: string[] = [];
  const roles = session?.data?.roles;
  if (Array.isArray(roles)) {
    for (const r of roles) {
      if (r && typeof r.name === "string" && r.name) {
        names.push(r.name);
      }
    }
  }
  const single = session?.data?.role;
  if (typeof single === "string" && single) {
    names.push(single);
  }
  return names;
}

/**
 * Function that based on the sent permission determinates if a user can do an action
 * IMPORTANT: ADMIN ROLE HAS ALL PERMISSIONS
 * @param session Session => Permission type
 * @param allowedRoles string[] => Array of allowed Roles
 * @returns : boolean -> if set user has permission for desaired action
 */
export const hasRole = (session: any, allowedRoles: string[]) => {
  if (!session?.data) return false;
  const allowed = new Set([...allowedRoles, Role.ADMIN]);
  return sessionRoleNames(session).some((name) => allowed.has(name));
};

// ------- AUTH VALIDATIONS --------
/**
 * Validate if the user it's auth and it has the correct role to access
 * @param session Session: has auth user data
 * @param roles Role: Desired roles to validate with
 */
export const validateAccess = (
  session: any | undefined,
  roles: Role[]
): void => {
  if (!session || !hasRole(session, roles)) {
    throw new Error("Unauthorized: You don't have the right permissions");
  }
};
