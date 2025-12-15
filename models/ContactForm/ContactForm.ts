import { list } from "@keystone-6/core";
import { select, text, timestamp } from "@keystone-6/core/fields";
import access from "../../utils/generalAccess/access";

export const CONTACT_FORM_STATUS_OPTIONS = [
  { label: "Nuevo", value: "new" },
  { label: "Leído", value: "read" },
  { label: "En proceso", value: "in_progress" },
  { label: "Resuelto", value: "resolved" },
];

export default list({
  access,
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
