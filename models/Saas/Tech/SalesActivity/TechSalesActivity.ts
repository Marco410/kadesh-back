import { list } from "@keystone-6/core";
import {
  text,
  timestamp,
  select,
  relationship,
  checkbox,
  calendarDay,
} from "@keystone-6/core/fields";
import { salesActivityAccess } from "./TechSalesActivity.access";
import { SALES_ACTIVITY_TYPE, TASK_PRIORITY } from "../crm/constants";
import { salesActivityHooks } from "./TechSalesActivity.hooks";

const activityTypeOptions = Object.entries(SALES_ACTIVITY_TYPE).map(
  ([k, v]) => ({
    label: v,
    value: v,
  }),
);
const priorityOptions = Object.entries(TASK_PRIORITY).map(([k, v]) => ({
  label: v,
  value: v,
}));

export default list({
  access: salesActivityAccess,
  hooks: salesActivityHooks,
  ui: {
    listView: {
      initialColumns: [
        "type",
        "activityDate",
        "dueDate",
        "priority",
        "result",
        "businessLead",
        "responsible",
      ],
    },
  },
  fields: {
    title: text({
      ui: { description: "Título de la actividad" },
    }),
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
    dueDate: calendarDay({
      db: { isNullable: true },
      isIndexed: true,
      ui: { description: "Deadline for this activity" },
    }),
    priority: select({
      type: "string",
      options: priorityOptions,
      defaultValue: TASK_PRIORITY.MEDIA,
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
    createdBy: relationship({
      ref: "User.createdBySalesActivities",
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
