import { graphql, list } from "@keystone-6/core";
import {
  checkbox,
  integer,
  relationship,
  select,
  text,
  timestamp,
  virtual,
} from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";
import { KeystoneContext } from "@keystone-6/core/types";
import { dayNames } from "../Schedule/Schedule";
import {
  PET_PLACE_CLAIM_STATUS,
  PET_PLACE_CLAIM_STATUS_OPTIONS,
  PET_PLACE_CLAIM_ROLE_OPTIONS,
} from "./claim";
import { petPlaceSlugAfterOperation } from "./PetPlace.hooks";
import { PIPELINE_STATUS } from "../../Saas/Tech/crm/constants";

const pipelineOptions = Object.values(PIPELINE_STATUS).map((value) => ({
  label: value,
  value,
}));

export default list({
  access,
  ui: {
    listView: {
      initialColumns: ["name", "slug", "claimStatus", "verified", "municipality"],
    },
  },
  hooks: {
    afterOperation: petPlaceSlugAfterOperation.afterOperation,
    resolveInput: async ({ resolvedData, item, operation }) => {
      if (operation !== "update") return resolvedData;

      const wasVerified = Boolean(item?.verified);
      const nextVerified = resolvedData.verified;

      if (nextVerified === true && !wasVerified) {
        resolvedData.claimStatus = PET_PLACE_CLAIM_STATUS.VERIFIED;
        if (resolvedData.verifiedAt === undefined) {
          resolvedData.verifiedAt = new Date();
        }
      }

      if (nextVerified === false && wasVerified) {
        if (resolvedData.claimStatus === undefined) {
          resolvedData.claimStatus = item?.userId
            ? PET_PLACE_CLAIM_STATUS.PENDING
            : PET_PLACE_CLAIM_STATUS.UNCLAIMED;
        }
        if (resolvedData.verifiedAt === undefined) {
          resolvedData.verifiedAt = null;
        }
      }

      if (resolvedData.claimStatus === PET_PLACE_CLAIM_STATUS.VERIFIED) {
        resolvedData.verified = true;
        if (!wasVerified && resolvedData.verifiedAt === undefined) {
          resolvedData.verifiedAt = new Date();
        }
      }

      return resolvedData;
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description:
          "URL amigable. Se genera sola (nombre + municipio) y no cambia si editas el nombre.",
      },
    }),
    description: text({ validation: { isRequired: true } }),
    phone: text(),
    whatsapp: text({
      ui: { description: "WhatsApp de la clínica (solo dígitos, con lada)" },
    }),
    website: text(),
    email: text({
      ui: { description: "Correo público de la clínica" },
    }),
    emergencies: checkbox({
      defaultValue: false,
      ui: { description: "Atiende urgencias 24/7" },
    }),
    parking: checkbox({
      defaultValue: false,
      ui: { description: "Tiene estacionamiento" },
    }),
    appointmentRequired: checkbox({
      defaultValue: false,
      ui: { description: "Atiende solo con cita" },
    }),
    street: text(),
    municipality: text(),
    state: text(),
    country: text(),
    cp: text(),
    lat: text(),
    lng: text(),
    views: integer(),
    types: relationship({
      ref: "PetPlaceType",
      many: true,
    }),
    services: relationship({
      ref: "PetPlaceService",
      many: true,
    }),
    requested_services: relationship({
      ref: "PetPlaceService.requestedFor",
      many: true,
      ui: { description: "Servicios que esta clínica pidió al catálogo" },
    }),
    patients: relationship({
      ref: "User.clinic_patients_of",
      many: true,
      ui: { description: "Pacientes dados de alta por esta clínica" },
    }),
    user: relationship({
      ref: "User.pet_places",
      many: false,
      ui: { description: "Dueño o solicitante de la ficha" },
    }),
    verified: checkbox({
      defaultValue: false,
      ui: {
        description:
          "Marca cuando un admin ya validó que la clínica es de este usuario",
      },
    }),
    verifiedAt: timestamp({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
    claimStatus: select({
      options: PET_PLACE_CLAIM_STATUS_OPTIONS,
      defaultValue: PET_PLACE_CLAIM_STATUS.UNCLAIMED,
      ui: { displayMode: "segmented-control" },
    }),
    claimRole: select({
      options: PET_PLACE_CLAIM_ROLE_OPTIONS,
      ui: { description: "Rol declarado al reclamar" },
    }),
    pipelineStatus: select({
      type: "string",
      options: pipelineOptions,
      defaultValue: PIPELINE_STATUS.DETECTADO,
      isIndexed: true,
      ui: {
        description:
          "Estatus comercial interno (solo admin). No lo ve el dueño de la ficha.",
      },
    }),
    claimPhone: text({
      ui: { description: "Teléfono que dejó en la solicitud" },
    }),
    claimNotes: text({
      ui: {
        displayMode: "textarea",
        description: "Cómo comprueba que es suya (cédula, RFC, etc.)",
      },
    }),
    claimedAt: timestamp({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
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
    pet_place_appointments: relationship({
      ref: "PetPlaceAppointment.pet_place",
      many: true,
    }),
    pet_place_reviews: relationship({
      ref: "Review.pet_place",
      many: true,
    }),
    reviewsCount: virtual({
      field: graphql.field({
        type: graphql.Int,
        async resolve(item: any, args: any, context: KeystoneContext) {
          const reviews = await context.query.Review.findMany({
            where: {
              pet_place: {
                id: {
                  equals: item.id,
                },
              },
            },
            query: "id",
          });
          return reviews.length;
        },
      }),
    }),
    averageRating: virtual({
      field: graphql.field({
        type: graphql.Float,
        async resolve(item: any, args: any, context: KeystoneContext) {
          const reviews = await context.query.Review.findMany({
            where: {
              pet_place: {
                id: {
                  equals: item.id,
                },
              },
            },
            query: "rating",
          });

          if (reviews.length === 0) {
            return 0;
          }

          const totalRating = reviews.reduce((sum: number, review: any) => {
            return sum + (review.rating || 0);
          }, 0);

          const average = totalRating / reviews.length;
          // Round to 1 decimal place
          return Math.round(average * 10) / 10;
        },
      }),
    }),
    pet_place_ads: relationship({
      ref: "Ad.pet_place",
      many: true,
    }),
    address: text(),
    google_place_id: text({
      isIndexed: "unique",
      db: { isNullable: true },
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