import { list } from "@keystone-6/core";
import { checkbox, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import access from "../../../../utils/generalAccess/access";
import { petPlaceServiceHooks } from "./PetPlaceService.hooks";
import { PET_PLACE_SERVICE_STATUS, PET_PLACE_SERVICE_STATUS_OPTIONS } from "./status";

export default list({
  access,
  ui: {
    listView: {
      initialColumns: ["name", "status", "active", "requestedFor"],
    },
  },
  hooks: {
    resolveInput: petPlaceServiceHooks.resolveInput,
    afterOperation: petPlaceServiceHooks.afterOperation,
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({ isIndexed: "unique" }),
    description: text({ ui: { displayMode: "textarea" } }),
    active: checkbox({
      defaultValue: true,
      ui: {
        description: "Visible en el catálogo y en fichas. Solo si está aprobado.",
      },
    }),
    status: select({
      type: "string",
      options: PET_PLACE_SERVICE_STATUS_OPTIONS,
      defaultValue: PET_PLACE_SERVICE_STATUS.APPROVED,
      validation: { isRequired: true },
      ui: {
        displayMode: "segmented-control",
        description:
          "Pendiente = lo pidió un dueño. Aprobado = sale en el catálogo. Rechazado = no sale.",
      },
    }),
    requestedBy: relationship({
      ref: "User.requested_pet_place_services",
      many: false,
      ui: { description: "Dueño que pidió este servicio" },
    }),
    requestedFor: relationship({
      ref: "PetPlace.requested_services",
      many: false,
      ui: { description: "Clínica que lo pidió; al aprobar se conecta a sus servicios" },
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
