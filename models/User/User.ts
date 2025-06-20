import { graphql, list } from "@keystone-6/core";
import {
  text,
  password,
  timestamp,
  select,
  virtual,
  calendarDay,
  image,
  checkbox,
  relationship,
} from "@keystone-6/core/fields";
import { emailHooks, phoneHooks, userNameHook } from "./User.hooks";
import access from "../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    name: text({ validation: { isRequired: true } }),
    lastName: text(),
    secondLastName: text(),
    username: text({
      isIndexed: "unique",
      validation: { isRequired: true },
    }),
    email: text({
      isIndexed: "unique",
      hooks: emailHooks,
    }),
    password: password({
      validation: { isRequired: false },
      ui: {
        createView: {
          fieldMode: "hidden",
        },
      },
    }),
    phone: text({
      hooks: phoneHooks,
    }),
    role: select({
      type: "enum",
      validation: {
        isRequired: true,
      },
      defaultValue: "user",
      options: [
        { label: "Admnistrador", value: "admin" },
        { label: "User", value: "user" },
      ],
    }),
    profileImage: image({ storage: "my_local_images" }),
    birthday: calendarDay(),
    age: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any) {
          if (item?.birthday) {
            const today = new Date();
            const birthDate = new Date(item.birthday);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              age -= 1;
            }
            return age.toString();
          }
          return "";
        },
      }),
    }),
    smsRegistrationId: text(),
    verified: checkbox(),
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
