import { list } from "@keystone-6/core";
import {
  checkbox,
  integer,
  json,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { inegiSyncLogAccess } from "../access";
import { INEGI_SYNC_SOURCE_OPTIONS } from "../constants";

export default list({
  access: inegiSyncLogAccess,
  ui: {
    listView: {
      initialColumns: [
        "createdAt",
        "user",
        "success",
        "sourceMethod",
        "created",
        "updated",
        "alreadyInDb",
        "totalFetched",
      ],
    },
  },
  fields: {
    user: relationship({
      ref: "User.inegiSyncLogs",
      many: false,
      ui: { description: "Usuario que ejecutó el sync (vacío en scripts)" },
    }),
    success: checkbox({
      defaultValue: false,
    }),
    message: text(),
    created: integer({
      defaultValue: 0,
      ui: { description: "Establecimientos nuevos" },
    }),
    updated: integer({
      defaultValue: 0,
      ui: { description: "Establecimientos actualizados" },
    }),
    alreadyInDb: integer({
      defaultValue: 0,
      ui: { description: "Ya existían y no cambiaron (o se reencontraron)" },
    }),
    totalFetched: integer({
      defaultValue: 0,
      ui: { description: "Filas recibidas de INEGI en esta corrida" },
    }),
    sourceMethod: select({
      type: "string",
      options: [...INEGI_SYNC_SOURCE_OPTIONS],
      validation: { isRequired: true },
      defaultValue: "api",
    }),
    searchParams: json({
      ui: { description: "Parámetros de búsqueda o ruta del archivo" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
    }),
  },
});
