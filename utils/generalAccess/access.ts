import { BaseListTypeInfo, ListAccessControl } from "@keystone-6/core/types";

const access: ListAccessControl<BaseListTypeInfo> = {
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

export default access;
