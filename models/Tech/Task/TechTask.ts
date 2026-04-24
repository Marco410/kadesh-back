import { list } from "@keystone-6/core";
import {
  text,
  timestamp,
  select,
  relationship,
  checkbox,
} from "@keystone-6/core/fields";
import { techTaskAccess } from "./TechTask.access";
import {  TASK_PRIORITY } from "../crm/constants";
import { techTaskHooks } from "./TechTask.hooks";


const priorityOptions = Object.entries(TASK_PRIORITY).map(([k, v]) => ({
  label: v,
  value: v,
}));

export default list({
  access: techTaskAccess,
  hooks: techTaskHooks,
  ui: {
    listView: {
      initialColumns: [
        "type",
        "startDate",
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
      ui: { description: "Título de la tarea" },
    }),
    startDate: timestamp({
      defaultValue: { kind: "now" },
      validation: { isRequired: true },
      ui: { description: "Fecha de la tarea (programada o realizada)" },
    }),
    dueDate: timestamp({
      db: { isNullable: true },
      isIndexed: true,
      ui: { description: "Fecha límite de la tarea" },
    }),
    priority: select({
      type: "string",
      options: priorityOptions,
      defaultValue: TASK_PRIORITY.MEDIA,
    }),
    result: text({
      ui: { description: "Resultado o cierre de la tarea" },
    }),
    comments: text({ ui: { displayMode: "textarea" } }),
    businessLead: relationship({
      ref: "TechBusinessLead.tasks",
      many: false,
    }),
    responsible: relationship({
      ref: "User.tasksResponsible",
      many: false,
    }),
    workspace: relationship({
      ref: "SaasWorkspace.tasks",
      many: false,
      ui: { description: "Workspace al que pertenece esta tarea" },
    }),
    statusCrm: relationship({
      ref: "SaasWorkspaceCrmStatus.tasks",
      many: false,
      ui: {
        description: "Estado CRM dinámico (workspace + tipo de tarea)",
      },
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
