import { list } from "@keystone-6/core";
import { text, timestamp, select, relationship, checkbox } from "@keystone-6/core/fields";
import { salesActivityAccess } from "./TechSalesActivity.access";
import { SALES_ACTIVITY_TYPE } from "../crm/constants";
import { salesActivityHooks } from "./TechSalesActivity.hooks";

const activityTypeOptions = Object.entries(SALES_ACTIVITY_TYPE).map(
  ([k, v]) => ({
    label: v,
    value: v,
  }),
);

export default list({
  access: salesActivityAccess,
  hooks: salesActivityHooks,
  ui: {
    listView: {
      initialColumns: [
        "type",
        "activityDate",
        "result",
        "businessLead",
        "assignedSeller",
      ],
    },
  },
  fields: {
    type: select({
      type: "string",
      options: activityTypeOptions,
      validation: { isRequired: true },
      isIndexed: true,
    }),
    activityDate: timestamp({
      defaultValue: { kind: "now" },
      validation: { isRequired: true },
    }),
    result: text({ ui: { description: "Resultado de la interacción" } }),
    comments: text({ ui: { displayMode: "textarea" } }),
    businessLead: relationship({
      ref: "TechBusinessLead.activities",
      many: false,
    }),
    assignedSeller: relationship({
      ref: "User.salesActivities",
      many: false,
    }),
    workspace: relationship({
      ref: "SaasWorkspace.salesActivities",
      many: false,
      ui: { description: "Workspace a la que pertenece la actividad" },
    }),
    statusCrm: relationship({
      ref: "SaasWorkspaceCrmStatus.salesActivities",
      many: false,
      ui: { description: "Estado CRM dinámico (workspace + tipo actividad)" },
    }),
    hiddenInWorkspace: checkbox({
      defaultValue: false,
      ui: { description: "Ocultar en el workspace" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
  },
});
