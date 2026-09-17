import { list } from "@keystone-6/core";
import { checkbox, text, timestamp } from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    name: text(),
    slug: text(),
    description: text({ ui: { displayMode: "textarea" } }),
    active: checkbox(),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
