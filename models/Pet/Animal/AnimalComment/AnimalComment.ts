import { list } from "@keystone-6/core";
import { relationship, text, timestamp } from "@keystone-6/core/fields";
import { animalUserRowAccess, forceSessionUser } from "../Animal.access";

export default list({
  access: animalUserRowAccess,
  hooks: {
    resolveInput: ({ resolvedData, operation, context }) =>
      forceSessionUser(resolvedData, operation, context),
  },
  fields: {
    comment: text({
      validation: { isRequired: true },
      ui: { displayMode: "textarea" },
    }),
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
