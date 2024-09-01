import { text, relationship } from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import hooks from "./TokenNotification.hooks";
import access from "../../utils/generalAccess/access";

export default list({
  access,
  hooks: hooks.hooks,
  fields: {
    token: text({
      ui: {
        displayMode: "textarea",
      },
    }),
    user: relationship({
      ref: "User",
      many: false,
    }),
  },
});
