import { graphql, list } from "@keystone-6/core";
import {
  integer,
  relationship,
  text,
  timestamp,
  virtual,
} from "@keystone-6/core/fields";
import access from "../../utils/generalAccess/access";
import { phoneHooks } from "../User/User.hooks";
import { KeystoneContext } from "@keystone-6/core/types";
import { dayNames } from "../Schedule/Schedule";

export default list({
  access,
  fields: {
    name: text({ validation: { isRequired: true } }),
    description: text({ validation: { isRequired: true } }),
    phone: text({
      hooks: phoneHooks,
    }),
    website: text(),
    street: text(),
    municipality: text(),
    state: text(),
    country: text(),
    cp: text(),
    lat: text(),
    lng: text(),
    views: integer(),
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
              pet_shelter: {
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
    pet_shelter_social_media: relationship({
      ref: "SocialMedia.pet_shelter",
      many: true,
    }),
    /*  veterinary_likes: relationship({
      ref: "VeterinaryLike.veterinary",
      many: true,
    }), */
    pet_shelter_schedules: relationship({
      ref: "Schedule.pet_shelter",
      many: true,
    }),
    pet_shelter_reviews: relationship({
      ref: "Review.pet_shelter",
      many: true,
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});

const getHoursAndMinutes = (date: Date) => ({
  hours: date.getUTCHours(),
  minutes: date.getUTCMinutes(),
});
