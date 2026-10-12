import { hasRole } from "../../../../auth/permissions";
import { Role } from "../../../Role/constants";
import { getSessionCompanyId } from "../../../../utils/access/tenant";

/** Id de una relación tal como llega en `resolvedData` (`{ connect: { id } }`). */
function connectedId(rel: any): string | null {
  return rel?.connect?.id ?? null;
}

export const statusBusinessLeadHooks = {
  resolveInput: async ({
    resolvedData,
    context,
    operation,
  }: any) => {
    // El estatus es de la empresa: `salesPerson` ya no se escribe (un front viejo en caché lo
    // seguiría mandando y reviviría el pipeline por vendedor).
    const next = { ...resolvedData };
    delete next.salesPerson;

    const isAdmin = hasRole(context.session, [Role.ADMIN]);
    const companyId = getSessionCompanyId(context.session);

    if (!isAdmin) {
      if (operation === "create" && companyId) {
        next.saasCompany = { connect: { id: companyId } };
      } else {
        delete next.saasCompany;
      }
    }

    if (operation === "create") {
      const leadId = connectedId(next.businessLead);
      const statusCompanyId = connectedId(next.saasCompany);
      if (leadId && statusCompanyId) {
        const existing = await context.sudo().db.TechStatusBusinessLead.count({
          where: {
            businessLead: { id: { equals: leadId } },
            saasCompany: { id: { equals: statusCompanyId } },
          },
        });
        // El índice único también lo frena; aquí es para dar un mensaje legible.
        if (existing > 0) {
          throw new Error(
            "Este lead ya tiene estatus en el pipeline de tu empresa. Actualiza el existente.",
          );
        }
      }
    }

    return next;
  },
};
