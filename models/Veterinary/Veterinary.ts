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
    services: relationship({
      ref: "VeterinaryService",
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
              veterinary: {
                id: {
                  equals: item.id,
                },
              },
            },
            query: "day timeIni timeEnd",
          });

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
    veterinary_social_media: relationship({
      ref: "SocialMedia.veterinary",
      many: true,
    }),
    veterinary_likes: relationship({
      ref: "VeterinaryLike.veterinary",
      many: true,
    }),
    veterinary_schedules: relationship({
      ref: "Schedule.veterinary",
      many: true,
    }),
    veterinary_reviews: relationship({
      ref: "Review.veterinary",
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
