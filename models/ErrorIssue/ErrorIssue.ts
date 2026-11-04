import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../utils/access/presets";
import { ERROR_ISSUE_STATUS, ERROR_ISSUE_STATUS_OPTIONS } from "./constants";

/**
 * Estado de un error agrupado (bandeja de Errores de Operaciones). Las ocurrencias viven en
 * `ActivityEvent` (tipos `app.*`) y se agrupan por `fingerprint`; esta fila solo guarda lo que
 * decide Kadesh: resuelto, ignorado o abierto, con una nota. Se crea al cambiar el estado.
 * Si un error resuelto vuelve a pasar, la bandeja lo muestra como reabierto.
 */
export default list({
  access: adminOnlyAccess,
  ui: {
    listView: {
      initialColumns: ["fingerprint", "status", "resolvedAt", "resolvedBy", "updatedAt"],
      initialSort: { field: "updatedAt", direction: "DESC" },
    },
  },
  fields: {
    fingerprint: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      ui: { description: "ActivityEvent.fingerprint del error" },
    }),
    status: select({
      type: "string",
      options: [...ERROR_ISSUE_STATUS_OPTIONS],
      defaultValue: ERROR_ISSUE_STATUS.OPEN,
      validation: { isRequired: true },
      isIndexed: true,
      ui: { displayMode: "segmented-control" },
    }),
    note: text({
      ui: { displayMode: "textarea", description: "Qué se hizo o por qué se ignora" },
    }),
    resolvedAt: timestamp({
      db: { isNullable: true },
      ui: { description: "Cuándo se marcó resuelto (si vuelve a pasar después, se reabre)" },
    }),
    resolvedBy: relationship({
      ref: "User",
      many: false,
      ui: { description: "Quién cambió el estado" },
    }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
});
