import { KeystoneContext } from "@keystone-6/core/types";
import { Role } from "../../models/Role/constants";
import { provisionSignupCompany } from "../access/provisionSignupCompany";

const ADMIN_EMAIL = "marco_pascual410@hotmail.com";
const ADMIN_COMPANY_NAME = "Kadesh";

/** Roles del user de seed: plataforma + empresa. */
const ADMIN_ROLE_NAMES = [
  Role.ADMIN,
  Role.ADMIN_COMPANY,
  Role.VENDEDOR,
] as const;

async function findRoleIds(
  context: KeystoneContext,
  names: readonly string[],
): Promise<string[]> {
  const roles = (await context.sudo().query.Role.findMany({
    where: { name: { in: [...names] } },
    query: "id name",
  })) as { id: string; name: string }[];
  return names
    .map((name) => roles.find((role) => role.name === name)?.id)
    .filter((id): id is string => Boolean(id));
}

/**
 * Conecta admin / admin_company / vendedor si faltan.
 * Keystone `connect` en many-to-many no duplica si ya está ligado.
 */
async function ensureAdminRoles(
  context: KeystoneContext,
  userId: string,
): Promise<void> {
  const roleIds = await findRoleIds(context, ADMIN_ROLE_NAMES);
  if (roleIds.length === 0) {
    console.warn(
      "⚠️  No se encontraron roles admin/admin_company/vendedor. Corre el seed de roles primero.",
    );
    return;
  }
  if (roleIds.length !== ADMIN_ROLE_NAMES.length) {
    console.warn(
      `⚠️  Solo se encontraron ${roleIds.length}/${ADMIN_ROLE_NAMES.length} roles de admin. Se conectan los que hay.`,
    );
  }
  await context.sudo().query.User.updateOne({
    where: { id: userId },
    data: {
      roles: { connect: roleIds.map((id) => ({ id })) },
    },
  });
}

async function ensureAdminCompany(
  context: KeystoneContext,
  userId: string,
  companyId?: string | null,
): Promise<void> {
  if (companyId) return;
  await provisionSignupCompany(context, userId, ADMIN_COMPANY_NAME);
  console.log("✅ Admin SaasCompany seeding complete.");
}

export async function createUserAdmin(context: KeystoneContext) {
  const sudo = context.sudo();
  const existingUser = (await sudo.query.User.findOne({
    where: { email: ADMIN_EMAIL },
    query: "id company { id }",
  })) as { id: string; company?: { id: string } | null } | null;

  if (existingUser) {
    await ensureAdminCompany(
      context,
      existingUser.id,
      existingUser.company?.id,
    );
    await ensureAdminRoles(context, existingUser.id);
    console.log(
      "♻️  User de seed ya existía: roles admin + admin_company + vendedor asegurados.",
    );
    return existingUser.id;
  }

  const roleIds = await findRoleIds(context, ADMIN_ROLE_NAMES);
  const data = await sudo.query.User.createOne({
    data: {
      name: "Marco",
      lastName: "Castañeda",
      username: "marco410",
      email: ADMIN_EMAIL,
      password: "1234567890",
      ...(roleIds.length > 0 && {
        roles: { connect: roleIds.map((id) => ({ id })) },
      }),
    },
    query: "id",
  });

  await ensureAdminCompany(context, data.id);
  await ensureAdminRoles(context, data.id);
  console.log("✅ User seeding complete (admin + admin_company + vendedor).");

  return data.id;
}
