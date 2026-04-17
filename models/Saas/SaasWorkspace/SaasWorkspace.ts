import { list } from "@keystone-6/core";
import { text, relationship, checkbox } from "@keystone-6/core/fields";
import { saasWorkspaceAccess } from "./SaasWorkspace.access";
import { saasWorkspaceSeedCrmStatusesHook } from "./SaasWorkspace.hooks";

export default list({
  access: saasWorkspaceAccess,
  hooks: {
    afterOperation: saasWorkspaceSeedCrmStatusesHook.afterOperation,
  },
  ui: {
    listView: {
      initialColumns: ["name", "company", "members"],
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Nombre del área (ej. Recursos Humanos, Diseño)" },
    }),
    showActivities: checkbox({
      defaultValue: true,
      ui: { description: "Mostrar actividades de CRM en este workspace" },
    }),
    showProposals: checkbox({
      defaultValue: true,
      ui: { description: "Mostrar propuestas de CRM en este workspace" },
    }),
    showFollowUpTasks: checkbox({
      defaultValue: true,
      ui: { description: "Mostrar tareas de seguimiento de CRM en este workspace" },
    }),
    company: relationship({
      ref: "SaasCompany.workspaces",
      many: false,
      ui: { description: "Empresa (tenant) a la que pertenece" },
    }),
    members: relationship({
      ref: "User.workspaces",
      many: true,
      ui: { description: "Usuarios con acceso a este workspace" },
    }),
    salesActivities: relationship({
      ref: "TechSalesActivity.workspace",
      many: true,
      ui: { hideCreate: true, description: "Actividades de CRM" },
    }),
    proposals: relationship({
      ref: "TechProposal.workspace",
      many: true,
      ui: { hideCreate: true, description: "Propuestas de CRM" },
    }),
    followUpTasks: relationship({
      ref: "TechFollowUpTask.workspace",
      many: true,
      ui: { hideCreate: true, description: "Tareas de seguimiento de CRM" },
    }),
    crmStatuses: relationship({
      ref: "SaasWorkspaceCrmStatus.workspace",
      many: true,
      ui: { hideCreate: true, description: "Estados CRM dinámicos por tipo" },
    }),
  },
});
