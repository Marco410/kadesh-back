import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { PIPELINE_STATUS } from "../crm/constants";
import { techLeadStageChangeAccess } from "./TechLeadStageChange.access";

const pipelineOptions = Object.values(PIPELINE_STATUS).map((value) => ({ label: value, value }));

/**
 * Una fila cada vez que un lead cambia de etapa en el pipeline de una empresa (también cuando
 * entra por primera vez, con `fromStatus` vacío). `TechStatusBusinessLead` solo guarda la etapa
 * actual; con esto se mide cuánto dura cada etapa, cuántos avanzan y el ciclo de venta.
 * Lo llena el hook `recordStageChange` de `TechStatusBusinessLead` en cada escritura (personas,
 * extracciones y automatismos). Ver `models/Saas/Tech/LeadStageChange/README.md`.
 */
export default list({
  access: techLeadStageChangeAccess,
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ["changedAt", "company", "businessLead", "fromStatus", "toStatus", "changedBy"],
      initialSort: { field: "changedAt", direction: "DESC" },
    },
  },
  fields: {
    company: relationship({ ref: "SaasCompany", many: false }),
    businessLead: relationship({ ref: "TechBusinessLead", many: false }),
    statusId: text({
      isIndexed: true,
      validation: { isRequired: true },
      ui: { description: "TechStatusBusinessLead (estatus del lead en esa empresa)" },
    }),
    fromStatus: select({
      type: "string",
      options: pipelineOptions,
      db: { isNullable: true },
      ui: { description: "Etapa anterior (vacía si es la primera)" },
    }),
    toStatus: select({
      type: "string",
      options: pipelineOptions,
      isIndexed: true,
      validation: { isRequired: true },
      ui: { description: "Etapa nueva" },
    }),
    changedBy: relationship({ ref: "User", many: false }),
    source: text({
      db: { isNullable: true },
      ui: { description: "web (una persona), system (servidor) o backfill (recuperado de ActivityEvent)" },
    }),
    changedAt: timestamp({
      defaultValue: { kind: "now" },
      isIndexed: true,
      validation: { isRequired: true },
    }),
  },
});
