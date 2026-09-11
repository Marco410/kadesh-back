import { KeystoneContext } from "@keystone-6/core/types";

/**
 * Liga un usuario a una empresa sin pasar por field access de GraphQL.
 * Usado en registro, Google y alta de negocio desde el panel.
 */
export async function attachUserToCompany(
  context: KeystoneContext,
  userId: string,
  companyId: string,
): Promise<void> {
  await context.sudo().prisma.user.update({
    where: { id: userId },
    data: { company: { connect: { id: companyId } } },
  });
}
