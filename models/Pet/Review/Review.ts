import { list } from "@keystone-6/core";
import {
  integer,
  relationship,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { userRowAccess } from "../../../utils/access/presets";
import { reviewResolveInput, reviewValidateInput } from "./Review.hooks";
import { logReviewActivity } from "../../../utils/pet/petActivity";

export default list({
  access: userRowAccess,
  hooks: {
    resolveInput: reviewResolveInput,
    validateInput: reviewValidateInput,
    // Actividad de Kadesh Pet: reseña nueva o borrada (sin el texto).
    afterOperation: async (args: any) => {
      void logReviewActivity(args);
    },
  },
  fields: {
    rating: integer(),
    review: text(),
    pet_place: relationship({
      ref: "PetPlace.pet_place_reviews",
    }),
    product: relationship({
      ref: "Product.product_reviews",
    }),
    user: relationship({
      ref: "User",
      many: false,
    }),
    google_user: text(),
    google_user_photo: text(),
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
