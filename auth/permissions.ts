// -------- MAIN AUTH VALIDATIONS

import { Role } from "../models/Role/constants";

/**
 * Function that based on the sent permission determinates if a user can do an action
 * IMPORTANT: ADMIN ROLE HAS ALL PERMISSIONS
 * @param session Session => Permission type
 * @param allowedRoles string[] => Array of allowed Roles
 * @returns : boolean -> if set user has permission for desaired action
 */
export const hasRole = (session: any, allowedRoles: string[]) =>
  !!session && [...allowedRoles, Role.ADMIN].includes(session.data.role || "");

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
