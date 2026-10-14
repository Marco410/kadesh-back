import { list } from "@keystone-6/core";
import { relationship, timestamp } from "@keystone-6/core/fields";
import { animalViewAccess, forceSessionUser } from "../Animal.access";

export default list({
  access: animalViewAccess,
  hooks: {
    resolveInput: ({ resolvedData, operation, context }) =>
      forceSessionUser(resolvedData, operation, context),
  },
  fields: {
    user: relationship({
      ref: "User",
      many: false,
    }),
    animal: relationship({
      ref: "Animal.animal_views",
      many: false,
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
  },
});
