import { list } from "@keystone-6/core";
import { relationship, timestamp } from "@keystone-6/core/fields";
import { forceSessionUser, userRowAccess } from "../../../../utils/access/presets";

export default list({
  access: userRowAccess,
  hooks: {
    // A nombre de quien tiene la sesión: el cliente no puede firmar por otra persona.
    resolveInput: ({ resolvedData, operation, context }) =>
      forceSessionUser(resolvedData, operation, context),
  },
  fields: {
    user: relationship({
      ref: "User",
      many: false,
    }),
    pet_place: relationship({
      ref: "PetPlace.pet_place_likes",
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
