import { list } from "@keystone-6/core";
import {
  text,
  float,
  timestamp,
  calendarDay,
  select,
  relationship,
  checkbox,
} from "@keystone-6/core/fields";
import { proposalAccess } from "./TechProposal.access";
import { proposalHooks } from "./TechProposal.hooks";
import { PROPOSAL_STATUS } from "../crm/constants";

const statusOptions = Object.entries(PROPOSAL_STATUS).map(([k, v]) => ({
  label: v,
  value: v,
}));

export default list({
  access: proposalAccess,
  hooks: proposalHooks,
  ui: {
    listView: {
      initialColumns: ["sentDate", "amount", "status", "businessLead"],
    },
  },
  fields: {
    sentDate: calendarDay({
      validation: { isRequired: true },
      ui: { description: "Fecha envío" },
    }),
    amount: float({ ui: { description: "Monto" } }),
    status: select({
      type: "string",
      options: statusOptions,
      defaultValue: PROPOSAL_STATUS.ENVIADA,
      isIndexed: true,
    }),
    fileOrUrl: text({
      ui: { description: "URL o referencia al archivo de la propuesta" },
    }),
    approved: checkbox({
      defaultValue: false,
      ui: { description: "Aprobado por administrador" },
    }),
    paid: checkbox({
      defaultValue: false,
      ui: { description: "Pagado" },
    }),
    product: text({
      ui: { description: "Producto o servicio principal cotizado" },
    }),
    notes: text({
      ui: {
        displayMode: "textarea",
        description: "Notas adicionales o condiciones de la propuesta",
      },
    }),
    businessLead: relationship({
      ref: "TechBusinessLead.proposals",
      many: false,
    }),
    assignedSeller: relationship({
      ref: "User.proposals",
      many: false,
    }),
    createdBy: relationship({
      ref: "User.createdByProposals",
      many: false,
    }),
    workspace: relationship({
      ref: "SaasWorkspace.proposals",
      many: false,
      ui: { description: "Workspace a la que pertenece la propuesta" },
    }),
    statusCrm: relationship({
      ref: "SaasWorkspaceCrmStatus.proposals",
      many: false,
      ui: { description: "Estado CRM dinámico (workspace + tipo propuesta)" },
    }),
    project: relationship({
      ref: "SaasProject.proposal",
      many: false,
      ui: { description: "Proyecto creado a partir de esta propuesta" },
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
    updatedAt: timestamp({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
  },
});
