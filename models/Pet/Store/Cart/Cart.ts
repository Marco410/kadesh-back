import { list } from "@keystone-6/core";
import { relationship, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";

export default list({
  access: adminOnlyAccess,
  fields: {
    name: text({ validation: { isRequired: true } }),
    user: relationship({
      ref: "User",
      many: false,
    }),
    product: relationship({
      ref: "Product",
      many: true,
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
