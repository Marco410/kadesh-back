import { ListAccessControl } from "@keystone-6/core/types";

export const saasPaymentMethodAccess: ListAccessControl<unknown> = {
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
