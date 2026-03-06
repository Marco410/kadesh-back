import { ListAccessControl } from "@keystone-6/core/types";

export const saasPaymentAccess: ListAccessControl<any> = {
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
