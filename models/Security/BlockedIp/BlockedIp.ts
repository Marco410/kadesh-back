import { list } from "@keystone-6/core";
import { relationship, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../utils/access/presets";

/**
 * IPs bloqueadas desde Operaciones → Seguridad (fase 6.5). Toda petición a GraphQL desde una IP
 * de esta lista responde `IP_BLOCKED` antes de tocar la sesión (`utils/security/blockedIps.ts`).
 * Sin `expiresAt`, el bloqueo es indefinido. Salida de emergencia: `pnpm security:unblock <ip>`.
 */
export default list({
  access: adminOnlyAccess,
  ui: {
    listView: {
      initialColumns: ["ip", "reason", "expiresAt", "createdBy", "createdAt"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  fields: {
    ip: text({
      isIndexed: "unique",
      validation: { isRequired: true },
    }),
    reason: text({
      ui: { displayMode: "textarea", description: "Por qué se bloqueó (abuso, spam, fuerza bruta…)" },
    }),
    expiresAt: timestamp({
      db: { isNullable: true },
      ui: { description: "Hasta cuándo. Vacío = indefinido." },
    }),
    createdBy: relationship({
      ref: "User",
      many: false,
      ui: { description: "Admin que la bloqueó" },
    }),
    createdAt: timestamp({ defaultValue: { kind: "now" }, isIndexed: true }),
  },
});
