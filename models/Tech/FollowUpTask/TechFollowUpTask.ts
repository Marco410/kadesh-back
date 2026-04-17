import { list } from "@keystone-6/core";
import {
  text,
  calendarDay,
  select,
  relationship,
  timestamp,
  checkbox,
} from "@keystone-6/core/fields";
import { followUpTaskAccess } from "./TechFollowUpTask.access";
import { FOLLOW_UP_TASK_STATUS, TASK_PRIORITY } from "../crm/constants";
import { followUpTaskHooks } from "./TechFollowUpTask.hooks";

const statusOptions = Object.entries(FOLLOW_UP_TASK_STATUS).map(([k, v]) => ({
  label: v,
  value: v,
}));
const priorityOptions = Object.entries(TASK_PRIORITY).map(([k, v]) => ({
  label: v,
  value: v,
}));

export default list({
  access: followUpTaskAccess,
  hooks: followUpTaskHooks,
  ui: {
    listView: {
      initialColumns: [
        "scheduledDate",
        "status",
        "priority",
        "businessLead",
        "assignedSeller",
      ],
    },
  },
  fields: {
    scheduledDate: calendarDay({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Fecha programada" },
    }),
    status: select({
      type: "string",
      options: statusOptions,
      defaultValue: FOLLOW_UP_TASK_STATUS.PENDIENTE,
      isIndexed: true,
    }),
    priority: select({
      type: "string",
      options: priorityOptions,
      defaultValue: TASK_PRIORITY.MEDIA,
    }),
    businessLead: relationship({
      ref: "TechBusinessLead.followUpTasks",
      many: false,
    }),
    assignedSeller: relationship({
      ref: "User.followUpTasks",
      many: false,
    }),
    workspace: relationship({
      ref: "SaasWorkspace.followUpTasks",
      many: false,
      ui: { description: "Workspace a la que pertenece la tarea" },
    }),
    statusCrm: relationship({
      ref: "SaasWorkspaceCrmStatus.followUpTasks",
      many: false,
      ui: { description: "Estado CRM dinámico (workspace + tipo tarea)" },
    }),
    notes: text({ ui: { displayMode: "textarea" } }),
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
    updatedAt: timestamp({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
  },
});
