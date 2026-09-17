import { hasRole } from "../../../../auth/permissions";
import { Role } from "../../../Role/constants";
import { getSessionCompanyId } from "../../../../utils/access/tenant";

export const statusBusinessLeadHooks = {
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
        saasCompany: { connect: { id: companyId } },
      };
    }

    const next = { ...resolvedData };
    delete next.saasCompany;
    return next;
  },
};
