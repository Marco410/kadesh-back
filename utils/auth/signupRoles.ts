import { KeystoneContext } from "@keystone-6/core/types";
import { Role } from "../../models/Role/constants";

/** Roles que recibe toda alta de Kadesh Negocios (registerUser y alta con Google). */
export const SIGNUP_ROLE_NAMES = [Role.VENDEDOR, Role.ADMIN_COMPANY] as const;

export async function findSignupRoleIds(
  context: KeystoneContext,
): Promise<string[]> {
  const roles = (await context.sudo().query.Role.findMany({
    where: { name: { in: [...SIGNUP_ROLE_NAMES] } },
    query: "id name",
  })) as { id: string; name: string }[];
  return SIGNUP_ROLE_NAMES.map(
    (name) => roles.find((role) => role.name === name)?.id,
  ).filter((id): id is string => Boolean(id));
}
