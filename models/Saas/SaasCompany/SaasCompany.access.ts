import { ListAccessControl } from "@keystone-6/core/types";

/** Open access for SaaS Company list. Restrict in production as needed. */
export const saasCompanyAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  filter: {
    query: () => true,
    update: () => true,
    delete: () => true,
  },
};
