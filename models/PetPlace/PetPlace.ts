import { graphql, list } from "@keystone-6/core";
import {
  integer,
  relationship,
  select,
  text,
  timestamp,
  virtual,
} from "@keystone-6/core/fields";
import access from "../../utils/generalAccess/access";
import { KeystoneContext } from "@keystone-6/core/types";
import { dayNames } from "../Schedule/Schedule";
import { TYPES_PET_SHELTER } from "../../utils/constants/constants";

export default list({
  access,
  fields: {
    name: text({ validation: { isRequired: true } }),
    description: text({ validation: { isRequired: true } }),
    phone: text(),
    website: text(),
    street: text(),
    municipality: text(),
    state: text(),
    country: text(),
    cp: text(),
    lat: text(),
    lng: text(),
    views: integer(),
    type: select({
      defaultValue: "veterinary",
      options: TYPES_PET_SHELTER,
    }),
    services: relationship({
      ref: "PetPlaceService",
      many: true,
    }),
    user: relationship({
      ref: "User",
      many: false,
    }),
    isOpen: virtual({
      field: graphql.field({
        type: graphql.Boolean,
        async resolve(item: any, args: any, context: KeystoneContext) {
          const today = new Date();
          const schedules = await context.query.Schedule.findMany({
            where: {
              pet_place: {
                id: {
                  equals: item.id,
                },
              },
            },
            query: "day timeIni timeEnd",
          });

          if (schedules.length == 0) return false;

          let isInRange = schedules.some((e) => {
            if (e.day === dayNames[today.getDay()]) {
              if (
                today.getHours() >= e.timeIni &&
                today.getHours() <= e.timeEnd
              ) {
                return true;
              } else {
                return false;
              }
            }
            return false;
          });
          return isInRange;
        },
      }),
    }),
    pet_place_social_media: relationship({
      ref: "SocialMedia.pet_place",
      many: true,
    }),
    pet_place_likes: relationship({
      ref: "PetPlaceLike.pet_place",
      many: true,
    }),
    pet_place_schedules: relationship({
      ref: "Schedule.pet_place",
      many: true,
    }),
    pet_place_reviews: relationship({
      ref: "Review.pet_place",
      many: true,
    }),
    pet_place_ads: relationship({
      ref: "Ad.pet_place",
      many: true,
    }),
    address: text(),
    google_place_id: text({
      isIndexed: "unique",
      validation: { isRequired: false },
    }),
    google_opening_hours: text(),
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

const getHoursAndMinutes = (date: Date) => ({
  hours: date.getUTCHours(),
  minutes: date.getUTCMinutes(),
});
