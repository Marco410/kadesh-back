import { list } from "@keystone-6/core";
import {
  text,
  checkbox,
  relationship,
  timestamp,
  select,
} from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";
import {
  PRODUCT,
  SINGLE_PRODUCT_OPTIONS,
} from "../../../utils/constants/product";
import { blogSubscriptionHooks } from "./BlogSubscription.hooks";

export default list({
  access,
  hooks: {
    validateInput: blogSubscriptionHooks.validateInput,
  },
  fields: {
    email: text({
      // No es único: la unicidad es (email, product), ver BlogSubscription.hooks.ts
      isIndexed: true,
      ui: {
        displayMode: "input",
      },
    }),
    product: select({
      options: SINGLE_PRODUCT_OPTIONS,
      defaultValue: PRODUCT.PET,
      validation: { isRequired: true },
      isIndexed: true,
      ui: {
        displayMode: "select",
        description: "Blog al que está suscrito: Pet o SaaS",
      },
    }),
    user: relationship({
      ref: "User.blog_subscriptions",
      many: false,
      ui: {
        displayMode: "select",
      },
    }),
    active: checkbox({
      defaultValue: true,
      ui: {
        description: "Si está activo, recibirá notificaciones de nuevos posts",
      },
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
  ui: {
    labelField: "email",
    listView: {
      initialColumns: ["email", "product", "user", "active", "createdAt"],
    },
  },
});
