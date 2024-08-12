import { list } from "@keystone-6/core";
import { image, relationship, timestamp } from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";

export default list({
  access,
  fields: {
    image: image({
      storage: "my_local_images",
    }),
    animal: relationship({
      ref: "Animal.multimedia",
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
