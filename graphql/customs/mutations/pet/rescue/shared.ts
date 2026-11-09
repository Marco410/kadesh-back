import type { KeystoneContext } from "@keystone-6/core/types";

/** Tipos compartidos por las mutaciones de espacios de rescate (van una sola vez en index.ts). */
export const rescueSharedTypeDefs = `
  input RescueOrganizationCreateInput {
    name: String!
    "independent | shelter | foster_home | collective | civil_association"
    type: String!
    city: String
    state: String
    "Tipos de animal (ANIMAL_TYPE_OPTIONS): dog | cat | bird | fish | reptil | mammal"
    species: [String!]
    description: String
    "10 dígitos; contacto público una vez verificada"
    whatsapp: String
    email: String
    facebookUrl: String
    instagramUrl: String
    tiktokUrl: String
    websiteUrl: String
  }

  type RescueOrganizationResult {
    success: Boolean!
    message: String!
    organization: RescueOrganization
  }

  type RescueMemberResult {
    success: Boolean!
    message: String!
    "RESCUE_MEMBER_USER_NOT_FOUND cuando el correo no tiene cuenta"
    code: String
    member: RescueOrganizationMember
  }
`;

export const RESCUE_MEMBER_USER_NOT_FOUND = "RESCUE_MEMBER_USER_NOT_FOUND";

export function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

export function displayName(user: { name?: string | null; lastName?: string | null } | null | undefined): string {
  return [user?.name, user?.lastName].filter(Boolean).join(" ").trim();
}

export function rescuePanelPath(organizationId: string, vista?: string): string {
  return `/perfil?tab=rescate&org=${encodeURIComponent(organizationId)}${vista ? `&vista=${vista}` : ""}`;
}

export function petFrontendUrl(path: string): string {
  const base = (process.env.PET_FRONTEND_URL?.trim() || process.env.FRONTEND_URL?.trim() || "https://pet.kadesh.com.mx")
    .replace(/\/+$/, "");
  return `${base}${path}`;
}

/** Cuántos admins tiene la organización (para no dejarla sin ninguno). */
export async function countRescueAdmins(context: KeystoneContext, organizationId: string): Promise<number> {
  return context.sudo().query.RescueOrganizationMember.count({
    where: { organization: { id: { equals: organizationId } }, role: { equals: "admin" } },
  });
}
