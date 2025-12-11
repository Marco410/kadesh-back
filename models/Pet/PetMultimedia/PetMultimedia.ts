import { list } from "@keystone-6/core";
import { image, relationship, timestamp } from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    image: image({
      storage: "s3_pets",
    }),
    pet: relationship({
      ref: "Pet.multimedia",
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
