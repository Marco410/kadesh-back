import { ListAccessControl } from "@keystone-6/core/types";
import { statusLeadCompanyScopedWhere } from "../../../../utils/access/leadScopedFilter";
import {
  getSessionCompanyId,
  isPlatformAdmin,
  isSignedIn,
} from "../../../../utils/access/tenant";

export const statusBusinessLeadAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: ({ session }: any) =>
      isPlatformAdmin(session) || !!getSessionCompanyId(session),
    update: ({ session }: any) => isSignedIn(session),
    delete: ({ session }: any) => isSignedIn(session),
  },
  filter: {
    query: ({ session }: any) => statusLeadCompanyScopedWhere(session),
    update: ({ session }: any) => statusLeadCompanyScopedWhere(session),
    delete: ({ session }: any) => statusLeadCompanyScopedWhere(session),
  },
};
