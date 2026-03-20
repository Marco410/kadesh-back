import { list } from "@keystone-6/core";
import {
  text,
  integer,
  float,
  timestamp,
  relationship,
  checkbox,
} from "@keystone-6/core/fields";
import { techLeadSyncLogAccess } from "./TechLeadSyncLog.access";

export default list({
  access: techLeadSyncLogAccess,
  ui: {
    listView: {
      initialColumns: [
        "createdAt",
        "user",
        "success",
        "message",
        "syncedLeadsCount",
        "created",
        "alreadyInDb",
        "category",
      ],
    },
  },
  fields: {
    user: relationship({
      ref: "User.leadSyncLogs",
      many: false,
      ui: { description: "Usuario que ejecutó la sincronización" },
    }),
    company: relationship({
      ref: "SaasCompany.leadSyncLogs",
      many: false,
      ui: { description: "Empresa" },
    }),
    success: checkbox({
      defaultValue: false,
      ui: { description: "Si la operación fue exitosa" },
    }),
    message: text({
      ui: { description: "Mensaje de resultado" },
    }),
    created: integer({
      defaultValue: 0,
      ui: { description: "Leads creados desde Google" },
    }),
    alreadyInDb: integer({
      defaultValue: 0,
      ui: { description: "Leads ya en BD asignados a la company" },
    }),
    skippedLowRating: integer({
      defaultValue: 0,
      ui: { description: "Leads omitidos por rating/reseñas bajas" },
    }),
    syncedLeadsCount: integer({
      defaultValue: 0,
      ui: { description: "Total de leads asignados en esta ejecución" },
    }),
    syncedCount: integer({
      db: { isNullable: true },
      ui: { description: "Cuota usada este mes (total)" },
    }),
    leadLimit: integer({
      db: { isNullable: true },
      ui: { description: "Límite de leads del plan" },
    }),
    lat: float({
      db: { isNullable: true },
      ui: { description: "Latitud del centro de búsqueda" },
    }),
    lng: float({
      db: { isNullable: true },
      ui: { description: "Longitud del centro de búsqueda" },
    }),
    radius: float({
      db: { isNullable: true },
      ui: { description: "Radio de búsqueda (km)" },
    }),
    category: text({
      ui: { description: "Categoría buscada" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: { description: "Fecha y hora de la ejecución" },
    }),
  },
});
