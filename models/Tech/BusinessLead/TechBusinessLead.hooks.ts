import { hasRole } from "../../../auth/permissions";
import { Role } from "../../Role/constants";
import { getSessionCompanyId } from "../../../utils/access/tenant";

function stripTenantFromClient(
  resolvedData: Record<string, unknown>,
  key: string,
) {
  const next = { ...resolvedData };
  delete next[key];
  return next;
}

/**
 * El cliente no elige tenant: se fuerza la empresa de la sesión.
 * Admin de plataforma puede mandar saasCompany en el input.
 */
export const businessLeadHooks = {
  resolveInput: async ({
    resolvedData,
    context,
    operation,
  }: any) => {
    if (hasRole(context.session, [Role.ADMIN])) {
      return resolvedData;
    }

    const companyId = getSessionCompanyId(context.session);
    if (operation === "create" && companyId) {
      return {
        ...resolvedData,
        saasCompany: { connect: [{ id: companyId }] },
      };
    }

    return stripTenantFromClient(resolvedData, "saasCompany");
  },
  afterOperation: async () => {},
};
