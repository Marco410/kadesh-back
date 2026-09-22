import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { techWhatsAppMessageAccess } from "./TechWhatsAppMessage.access";

export default list({
  access: techWhatsAppMessageAccess,
  ui: {
    listView: {
      initialColumns: [
        "createdAt",
        "company",
        "businessLead",
        "direction",
        "status",
        "body",
      ],
    },
  },
  fields: {
    company: relationship({
      ref: "SaasCompany.whatsappMessages",
      many: false,
      ui: { description: "Empresa dueña del número de WhatsApp" },
    }),
    businessLead: relationship({
      ref: "TechBusinessLead.whatsappMessages",
      many: false,
      ui: { description: "Lead asociado (vacío si no matcheó ningún teléfono conocido)" },
    }),
    direction: select({
      type: "string",
      options: [
        { label: "Entrante", value: "inbound" },
        { label: "Saliente", value: "outbound" },
        { label: "Sin identificar", value: "unknown" },
      ],
      validation: { isRequired: true },
      isIndexed: true,
    }),
    source: select({
      type: "string",
      options: [
        { label: "Cloud API", value: "api" },
        { label: "Importado", value: "imported" },
      ],
      defaultValue: "api",
      isIndexed: true,
      ui: { description: "Si llegó en vivo por la Cloud API o se importó de un .txt exportado" },
    }),
    senderLabel: text({
      db: { isNullable: true },
      ui: {
        description:
          "Nombre del remitente tal cual venía en el .txt importado. Se usa cuando direction es 'unknown'.",
      },
    }),
    waMessageId: text({
      db: { isNullable: true },
      isIndexed: "unique",
      ui: { description: "ID de Meta. Usado para no duplicar reintentos del webhook." },
    }),
    fromPhone: text({ db: { isNullable: true } }),
    toPhone: text({ db: { isNullable: true } }),
    body: text({ ui: { displayMode: "textarea" } }),
    status: select({
      type: "string",
      options: [
        { label: "Enviado", value: "sent" },
        { label: "Recibido", value: "received" },
        { label: "Falló", value: "failed" },
      ],
      defaultValue: "sent",
    }),
    sentBy: relationship({
      ref: "User.whatsappMessagesSent",
      many: false,
      ui: { description: "Usuario que mandó el mensaje (solo salientes)" },
    }),
    errorMessage: text({
      db: { isNullable: true },
      ui: { displayMode: "textarea", description: "Error si el envío falló" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: { description: "Momento del mensaje" },
    }),
  },
});
