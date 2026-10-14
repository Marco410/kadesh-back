import { list } from "@keystone-6/core";
import { json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { notificationAccess, readOnlyField } from "./Notification.access";
import { NOTIFICATION_PRODUCT, NOTIFICATION_PRODUCT_OPTIONS } from "./constants";

/**
 * Notificaciones dentro de Kadesh (la campana), para Kadesh Pet y Kadesh Negocios. Una fila por
 * destinatario: así cada quien tiene su propio leído / no leído. Las crea solo el servidor con
 * `notify` (`utils/notifications/notify.ts`). Reemplazan los correos al admin, que gastaban el
 * cupo gratuito del proveedor de correo. Ver README.md.
 */
export default list({
  access: notificationAccess,
  ui: {
    listView: {
      initialColumns: ["title", "type", "recipient", "readAt", "createdAt"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  fields: {
    recipient: relationship({
      ref: "User",
      many: false,
      access: readOnlyField,
      ui: { description: "Quién la recibe" },
    }),
    product: select({
      type: "string",
      options: NOTIFICATION_PRODUCT_OPTIONS,
      defaultValue: NOTIFICATION_PRODUCT.SAAS,
      isIndexed: true,
      access: readOnlyField,
    }),
    type: text({
      isIndexed: true,
      access: readOnlyField,
      ui: { description: "animal.created, petplace.service_requested, …" },
    }),
    title: text({ validation: { isRequired: true }, access: readOnlyField }),
    body: text({ access: readOnlyField, ui: { displayMode: "textarea" } }),
    entityType: text({ access: readOnlyField }),
    entityId: text({ access: readOnlyField }),
    /** Ruta o URL a la que lleva el clic (p. ej. la pestaña de Operaciones o la ficha pública). */
    url: text({ access: readOnlyField }),
    metadata: json({ access: readOnlyField }),
    readAt: timestamp({ db: { isNullable: true } }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      isIndexed: true,
      access: readOnlyField,
    }),
  },
});
