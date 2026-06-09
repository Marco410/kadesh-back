import { ListAccessControl } from "@keystone-6/core/types";

/** Open access for SaaS Credit package list. Restrict in production as needed. */
export const saasCreditAccess: ListAccessControl<any> = {
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
