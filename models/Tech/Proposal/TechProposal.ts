import { list } from "@keystone-6/core";
import {
  text,
  float,
  timestamp,
  calendarDay,
  select,
  relationship,
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
    businessLead: relationship({
      ref: "TechBusinessLead.proposals",
      many: false,
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
