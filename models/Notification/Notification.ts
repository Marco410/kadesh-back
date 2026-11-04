import { list } from "@keystone-6/core";
import { integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { deliveryField, notificationAccess, readOnlyField } from "./Notification.access";
import {
  NOTIFICATION_PRODUCT,
  NOTIFICATION_PRODUCT_OPTIONS,
  PUSH_DELIVERY_OPTIONS,
  WHATSAPP_DELIVERY_OPTIONS,
} from "./constants";

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
    // ── A dónde se fue (solo admin la lee; la escribe el servidor). Ver README.md "Entrega".
    pushStatus: select({
      type: "string",
      options: PUSH_DELIVERY_OPTIONS,
      db: { isNullable: true },
      access: deliveryField,
      ui: { description: "Push a la app. Vacío = no aplica (solo Kadesh Pet)." },
    }),
    pushDevices: integer({
      db: { isNullable: true },
      access: deliveryField,
      ui: { description: "Dispositivos a los que se intentó mandar el push" },
    }),
    whatsappStatus: select({
      type: "string",
      options: WHATSAPP_DELIVERY_OPTIONS,
      db: { isNullable: true },
      access: deliveryField,
      ui: { description: "WhatsApp. Vacío = el tipo no tiene plantilla." },
    }),
    whatsappDetail: text({
      access: deliveryField,
      ui: { description: "Por qué no se mandó (sin_optin, sin_telefono…) o el error de Meta" },
    }),
    whatsappMessageId: text({
      isIndexed: true,
      access: deliveryField,
      ui: { description: "wamid de Meta: con él el webhook actualiza entregado / leído / falló" },
    }),
    whatsappUpdatedAt: timestamp({ db: { isNullable: true }, access: deliveryField }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      isIndexed: true,
      access: readOnlyField,
    }),
  },
});
