import { list } from "@keystone-6/core";
import {
  checkbox,
  json,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { activityEventAccess } from "./ActivityEvent.access";
import { ACTIVITY_CATEGORY_OPTIONS, ACTIVITY_SOURCE_OPTIONS } from "./constants";

/**
 * Qué hizo quién en la plataforma: auditoría y analítica de uso.
 * Complementa los logs que ya existen (accesos, extracciones, IA, cobros, CRM); no los duplica.
 * Relaciones de un solo lado a propósito: no agregan campos a User, SaasCompany ni SaasWorkspace.
 */
export default list({
  access: activityEventAccess,
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ["createdAt", "type", "summary", "actor", "company", "source", "success"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  fields: {
    type: text({
      isIndexed: true,
      validation: { isRequired: true },
      ui: { description: "Tipo de evento (ver models/ActivityEvent/constants.ts), p. ej. lead.status_changed" },
    }),
    category: select({
      type: "string",
      options: [...ACTIVITY_CATEGORY_OPTIONS],
      isIndexed: true,
      validation: { isRequired: true },
      ui: { description: "Sale del prefijo del tipo; coincide con los filtros del feed de Operaciones" },
    }),
    actor: relationship({
      ref: "User",
      many: false,
      ui: { description: "Quién lo hizo (vacío si fue el sistema o un webhook)" },
    }),
    company: relationship({
      ref: "SaasCompany",
      many: false,
      ui: { description: "Empresa a la que pertenece el dato afectado" },
    }),
    workspace: relationship({
      ref: "SaasWorkspace",
      many: false,
      ui: { description: "Espacio de trabajo, si aplica" },
    }),
    entityType: text({
      db: { isNullable: true },
      isIndexed: true,
      ui: { description: "List afectada (TechBusinessLead, SaasQuotation…)" },
    }),
    entityId: text({
      db: { isNullable: true },
      isIndexed: true,
      ui: { description: "Id del item afectado" },
    }),
    summary: text({
      ui: { displayMode: "textarea", description: "Texto legible en español" },
    }),
    metadata: json({
      ui: {
        description:
          "Cambios {campo: [antes, después]}, conteos, montos. Nunca contraseñas, tokens, prompts ni cuerpos de mensajes",
      },
    }),
    source: select({
      type: "string",
      options: [...ACTIVITY_SOURCE_OPTIONS],
      isIndexed: true,
      ui: { description: "panel, admin de Kadesh, webhook o sistema" },
    }),
    success: checkbox({ defaultValue: true }),
    errorMessage: text({
      db: { isNullable: true },
      ui: { displayMode: "textarea" },
    }),
    ip: text({
      db: { isNullable: true },
      ui: { description: "IP de la petición (x-forwarded-for del proxy si existe)" },
    }),
    userAgent: text({
      db: { isNullable: true },
      ui: { description: "Navegador o cliente que hizo la petición" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      isIndexed: true,
      ui: { description: "Cuándo ocurrió" },
    }),
  },
});
