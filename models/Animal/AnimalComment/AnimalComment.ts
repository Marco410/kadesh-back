import { list } from "@keystone-6/core";
import { relationship, text, timestamp } from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    comment: text({ validation: { isRequired: true } }),
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
