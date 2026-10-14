import { list } from "@keystone-6/core";
import { relationship, timestamp } from "@keystone-6/core/fields";
import { animalUserRowAccess, forceSessionUser } from "../Animal.access";

export default list({
  access: animalUserRowAccess,
  hooks: {
    resolveInput: ({ resolvedData, operation, context }) =>
      forceSessionUser(resolvedData, operation, context),
  },
  fields: {
    animal: relationship({
      ref: "Animal",
      many: false,
    }),
    user: relationship({
      ref: "User",
      many: false,
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
