import { list } from "@keystone-6/core";
import { relationship, timestamp } from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    user: relationship({
      ref: "User",
      many: false,
    }),
    veterinary: relationship({
      ref: "Veterinary.veterinary_likes",
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
