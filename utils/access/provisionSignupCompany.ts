import { KeystoneContext } from "@keystone-6/core/types";
import { attachUserToCompany } from "./attachUserToCompany";

/**
 * Misma secuencia que registerUser: crea la empresa (el hook de SaasCompany
 * arma workspace Ventas + plan free) y liga al usuario como miembro.
 */
export async function provisionSignupCompany(
  context: KeystoneContext,
  userId: string,
  companyName: string,
): Promise<string> {
  const company = (await context.sudo().query.SaasCompany.createOne({
    data: { name: companyName },
    query: "id",
  })) as { id: string };

  await attachUserToCompany(context, userId, company.id);

  const workspaces = (await context.sudo().query.SaasWorkspace.findMany({
    where: { company: { id: { equals: company.id } } },
    take: 1,
    query: "id",
  })) as { id: string }[];
  const workspaceId = workspaces[0]?.id;
  if (workspaceId) {
    await context.sudo().query.SaasWorkspace.updateOne({
      where: { id: workspaceId },
      data: {
        members: { connect: [{ id: userId }] },
      },
    });
  }

  return company.id;
}
