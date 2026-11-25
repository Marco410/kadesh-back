import { list } from "@keystone-6/core";
import {
  calendarDay,
  float,
  image,
  integer,
  multiselect,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../utils/access/presets";
import { adAfterOperation, adResolveInput, adValidateInput } from "./Ad.hooks";
import {
  AD_GEO_SCOPE,
  AD_GEO_SCOPE_OPTIONS,
  AD_KIND,
  AD_KIND_OPTIONS,
  AD_PAYMENT_METHOD_OPTIONS,
  AD_PAYMENT_STATUS,
  AD_PAYMENT_STATUS_OPTIONS,
  AD_PLACEMENT_OPTIONS,
  AD_STATUS,
  AD_STATUS_OPTIONS,
  AD_TONE,
  AD_WEIGHT,
} from "./constants";

const readOnly = { ui: { createView: { fieldMode: "hidden" as const }, itemView: { fieldMode: "read" as const } } };

/**
 * An ad shown in Kadesh Pet (web and app). See ./README.md.
 *
 * Admin only through the generated API: Operaciones edits them, the public reads them with
 * `activeAds` and counts impressions and clicks with `recordAdEvents` (stored in `AdDailyStat`).
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 100 },
  db: {
    extendPrismaSchema: (schema) => schema.replace(/\n\}\s*$/, "\n  @@index([status, endDate])\n}"),
  },
  ui: {
    labelField: "title",
    listView: {
      initialColumns: ["title", "kind", "status", "startDate", "endDate", "advertiserName"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  hooks: {
    resolveInput: adResolveInput as any,
    validateInput: adValidateInput as any,
    afterOperation: adAfterOperation as any,
  },
  fields: {
    kind: select({
      type: "string",
      options: AD_KIND_OPTIONS,
      defaultValue: AD_KIND.BRAND,
      validation: { isRequired: true },
    }),
    status: select({
      type: "string",
      options: AD_STATUS_OPTIONS,
      defaultValue: AD_STATUS.DRAFT,
      validation: { isRequired: true },
    }),

    title: text({ validation: { isRequired: true } }),
    body: text({ ui: { displayMode: "textarea" } }),
    brandLabel: text({ ui: { description: "Lo que va arriba del título, p. ej. «KADESH Business»." } }),
    ctaLabel: text({ ui: { description: "Texto del botón, p. ej. «Probar gratis»." } }),
    image: image({ storage: "s3_ads" }),
    tone: text({
      defaultValue: AD_TONE.ORANGE,
      validation: { isRequired: true },
      ui: { description: "Color de la tarjeta: orange, green, sky, violet, neutral o uno propio como #1f8a70." },
    }),

    // Target: exactly the one that matches `kind` (checked in Ad.hooks.ts).
    url: text({ ui: { description: "Destino de «Kadesh» y «Marca»: https://… o una ruta del sitio (/tienda)." } }),
    storeProduct: relationship({ ref: "StoreProduct" }),
    petPlace: relationship({ ref: "PetPlace.pet_place_ads" }),
    animal: relationship({ ref: "Animal" }),

    placements: multiselect({
      type: "string",
      options: AD_PLACEMENT_OPTIONS,
      defaultValue: [],
      ui: { description: "Dónde se muestra. El tipo solo sugiere; la decisión es de Operaciones." },
    }),
    startDate: calendarDay({ db: { isNullable: true }, ui: { description: "Vacío: desde hoy." } }),
    endDate: calendarDay({ db: { isNullable: true }, ui: { description: "Vacío: sin fecha de fin." } }),
    weight: integer({
      defaultValue: 5,
      validation: { isRequired: true, min: AD_WEIGHT.MIN, max: AD_WEIGHT.MAX },
      ui: { description: "Peso en la rotación (1–10): reparte el tiempo en pantalla. Con 2 sale el doble que con 1." },
    }),

    geoScope: select({
      type: "string",
      options: AD_GEO_SCOPE_OPTIONS,
      defaultValue: AD_GEO_SCOPE.NATIONAL,
      validation: { isRequired: true },
    }),
    lat: float({ db: { isNullable: true } }),
    lng: float({ db: { isNullable: true } }),
    radiusKm: integer({ db: { isNullable: true } }),
    zoneLabel: text({ ui: { description: "Para el reporte, p. ej. «Morelia y 15 km»." } }),

    advertiserName: text(),
    advertiserContact: text({ ui: { description: "Teléfono o correo del anunciante." } }),
    advertiserUser: relationship({
      ref: "User",
      ui: { description: "Su cuenta en Kadesh, si tiene. Servirá para que vea su reporte." },
    }),
    priceCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    paymentStatus: select({
      type: "string",
      options: AD_PAYMENT_STATUS_OPTIONS,
      defaultValue: AD_PAYMENT_STATUS.PENDING,
      validation: { isRequired: true },
    }),
    paymentMethod: select({ type: "string", options: AD_PAYMENT_METHOD_OPTIONS, db: { isNullable: true } }),
    paymentNote: text({ ui: { displayMode: "textarea" } }),

    createdAt: timestamp({ defaultValue: { kind: "now" }, ...readOnly }),
    updatedAt: timestamp({ db: { updatedAt: true }, ...readOnly }),
  },
});
