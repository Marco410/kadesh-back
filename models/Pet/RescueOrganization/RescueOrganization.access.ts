import type { KeystoneContext, ListAccessControl } from "@keystone-6/core/types";
import { GraphQLError } from "graphql";
import { adminOnly, anyone, signedIn } from "../../../utils/access/presets";
import { getSessionUserId, isPlatformAdmin } from "../../../utils/access/tenant";
import { RESCUE_ORG_STATUS, RESCUE_PROFILE_EDITOR_ROLES } from "./constants";

/**
 * Acceso de los espacios de rescate. Ver README.md.
 *
 * - `RescueOrganization`: el público solo lee las verificadas; el equipo lee la suya en cualquier
 *   estado. Así `animal.organization` llega en null al público mientras la organización está en
 *   revisión, y la ficha del animal muestra al autor como siempre. Crear pasa por
 *   `activateRescueOrganization` (crea también al primer admin); el perfil lo editan admin y
 *   coordinador; los campos de verificación y de aliado, solo un admin de plataforma.
 * - `RescueOrganizationMember`: el equipo se ve entre sí; se escribe con las mutaciones de
 *   `graphql/customs/mutations/pet/rescue/` (sudo), que validan el rol de quien llama.
 */

type AccessArgs = { session?: unknown };

/** Organizaciones donde `userId` es miembro (con alguno de `roles`, si se pasan). Sin atajo de admin. */
export function rescueOrgMemberFilter(userId: string, roles?: string[]) {
  return {
    members: {
      some: {
        user: { id: { equals: userId } },
        ...(roles?.length ? { role: { in: roles } } : {}),
      },
    },
  };
}

function visibleOrgWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const verified = { status: { equals: RESCUE_ORG_STATUS.VERIFIED } };
  const userId = getSessionUserId(session as any);
  return userId ? { OR: [verified, rescueOrgMemberFilter(userId)] } : verified;
}

function profileEditorWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  return userId ? rescueOrgMemberFilter(userId, RESCUE_PROFILE_EDITOR_ROLES) : false;
}

export const rescueOrganizationAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: adminOnly, update: signedIn, delete: adminOnly },
  filter: { query: visibleOrgWhere, update: profileEditorWhere },
};

function sameOrgMemberWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  return userId ? { organization: rescueOrgMemberFilter(userId) } : false;
}

export const rescueOrganizationMemberAccess: ListAccessControl<any> = {
  operation: { query: signedIn, create: adminOnly, update: adminOnly, delete: adminOnly },
  filter: { query: sameOrgMemberWhere },
};

/** Campos que solo escribe un admin de plataforma (verificación, aliado, slug). */
export const rescueAdminWriteField = {
  create: adminOnly,
  update: adminOnly,
};

/** Campos que solo lee un admin de plataforma (notas internas, quién la activó). */
export const rescueAdminReadField = {
  read: adminOnly,
  create: adminOnly,
  update: adminOnly,
};

/** Rol de `userId` en la organización, o null si no es miembro. Lee con sudo. */
export async function findRescueMemberRole(
  context: KeystoneContext,
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const rows = (await context.sudo().query.RescueOrganizationMember.findMany({
    where: { organization: { id: { equals: organizationId } }, user: { id: { equals: userId } } },
    query: "id role",
    take: 1,
  })) as Array<{ id: string; role: string }>;
  return rows[0]?.role ?? null;
}

export type RescueOrgRow = { id: string; name: string; slug: string | null; status: string };

/**
 * Para las mutaciones: exige sesión y uno de `roles` en la organización (un admin de plataforma
 * siempre pasa). Lanza un error legible si no.
 */
export async function requireRescueRole(
  context: KeystoneContext,
  organizationId: string,
  roles: string[],
): Promise<{ userId: string; role: string | null; organization: RescueOrgRow }> {
  const userId = getSessionUserId(context.session);
  if (!userId) throw new GraphQLError("Inicia sesión para continuar.");
  const organization = (await context.sudo().query.RescueOrganization.findOne({
    where: { id: organizationId },
    query: "id name slug status",
  })) as RescueOrgRow | null;
  if (!organization) throw new GraphQLError("No encontramos ese espacio de rescate.");
  if (isPlatformAdmin(context.session)) {
    return { userId, role: await findRescueMemberRole(context, organizationId, userId), organization };
  }
  const role = await findRescueMemberRole(context, organizationId, userId);
  if (!role || !roles.includes(role)) {
    throw new GraphQLError("Tu rol en este espacio no permite hacer esto.");
  }
  return { userId, role, organization };
}

/** Ids de quienes atienden la organización (para avisos). */
export async function rescueStaffIds(
  context: KeystoneContext,
  organizationId: string | null | undefined,
  roles: string[],
): Promise<string[]> {
  if (!organizationId) return [];
  try {
    const rows = (await context.sudo().query.RescueOrganizationMember.findMany({
      where: { organization: { id: { equals: organizationId } }, role: { in: roles } },
      query: "user { id }",
    })) as Array<{ user?: { id: string } | null }>;
    return rows.map((row) => row.user?.id ?? "").filter(Boolean);
  } catch (error) {
    console.error("[rescue] No se pudo leer el equipo de la organización", organizationId, error);
    return [];
  }
}
