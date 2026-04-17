import { list } from "@keystone-6/core";
import {
  text,
  relationship,
  integer,
  checkbox,
} from "@keystone-6/core/fields";
import { saasWorkspaceCrmStatusAccess } from "./SaasWorkspaceCrmStatus.access";
import { saasWorkspaceCrmStatusHooks } from "./SaasWorkspaceCrmStatus.hooks";

export default list({
  access: saasWorkspaceCrmStatusAccess,
  hooks: saasWorkspaceCrmStatusHooks,
  ui: {
    listView: {
      initialColumns: ["name", "key", "color", "order", "workspace"],
    },
  },
  fields: {
    workspace: relationship({
      ref: "SaasWorkspace.crmStatuses",
      many: false,
      ui: { description: "Workspace al que pertenece este estado" },
    }),
    name: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Nombre visible (p. ej. Kanban)" },
    }),
    color: text({
      validation: { isRequired: true },
      ui: { description: 'Color en hex de 6 dígitos, ej. "#2563EB"' },
    }),
    key: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: {
        description:
          "Clave estable para lógica de negocio (no cambiar en producción a la ligera)",
      },
    }),
    order: integer({
      defaultValue: 0,
      isIndexed: true,
      ui: { description: "Orden en la UI (menor primero)" },
    }),
    isDefault: checkbox({
      defaultValue: false,
      ui: {
        description:
          "Estado por defecto al crear registros CRM en el workspace (solo uno activo por workspace)",
      },
    }),
    isArchived: checkbox({
      defaultValue: false,
      ui: { description: "Ocultar en selectores sin borrar historial" },
    }),
    followUpTasks: relationship({
      ref: "TechFollowUpTask.statusCrm",
      many: true,
      ui: { hideCreate: true },
    }),
    proposals: relationship({
      ref: "TechProposal.statusCrm",
      many: true,
      ui: { hideCreate: true },
    }),
    salesActivities: relationship({
      ref: "TechSalesActivity.statusCrm",
      many: true,
      ui: { hideCreate: true },
    }),
  },
});
