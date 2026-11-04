import { list } from "@keystone-6/core";
import { select, text, timestamp } from "@keystone-6/core/fields";
import { anonymousCreateAccess, isClientNonAdmin } from "../../utils/access/presets";
import { logContactForm } from "../../utils/pet/petActivity";

export const CONTACT_FORM_STATUS_OPTIONS = [
  { label: "Nuevo", value: "new" },
  { label: "Leído", value: "read" },
  { label: "En proceso", value: "in_progress" },
  { label: "Resuelto", value: "resolved" },
];

export default list({
  // Cualquiera escribe; solo el admin lee los mensajes (nombre, correo y teléfono de quien escribe).
  access: anonymousCreateAccess,
  hooks: {
    // Un mensaje nuevo desde el sitio siempre entra como "Nuevo".
    resolveInput: ({ resolvedData, operation, context }) =>
      operation === "create" && isClientNonAdmin(context)
        ? { ...resolvedData, status: "new" }
        : resolvedData,
    afterOperation: async (args: any) => {
      void logContactForm(args);
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      ui: {
        displayMode: "input",
      },
    }),
    email: text({
      validation: { isRequired: true },
      ui: {
        displayMode: "input",
      },
    }),
    phone: text({
      validation: { isRequired: false },
      ui: {
        displayMode: "input",
      },
    }),
    subject: text({
      validation: { isRequired: true },
      ui: {
        displayMode: "input",
      },
    }),
    message: text({
      validation: { isRequired: true },
      ui: {
        displayMode: "textarea",
      },
    }),
    status: select({
      options: CONTACT_FORM_STATUS_OPTIONS,
      defaultValue: "new",
      ui: {
        displayMode: "select",
      },
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
  ui: {
    labelField: "subject",
    listView: {
      initialColumns: ["name", "email", "subject", "status", "createdAt"],
    },
  },
});
