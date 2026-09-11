import { ListAccessControl } from "@keystone-6/core/types";
import { leadCompanyScopedWhere } from "../../../utils/access/leadScopedFilter";
import {
  getSessionCompanyId,
  isPlatformAdmin,
  isSignedIn,
} from "../../../utils/access/tenant";

/** Solo se ven/editan/borran los leads de la SaasCompany del usuario. */
export const businessLeadAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: ({ session }: any) =>
      isPlatformAdmin(session) || !!getSessionCompanyId(session),
    update: ({ session }: any) => isSignedIn(session),
    delete: ({ session }: any) => isSignedIn(session),
  },
  filter: {
    query: ({ session }: any) => leadCompanyScopedWhere(session),
    update: ({ session }: any) => leadCompanyScopedWhere(session),
    delete: ({ session }: any) => leadCompanyScopedWhere(session),
  },
};
