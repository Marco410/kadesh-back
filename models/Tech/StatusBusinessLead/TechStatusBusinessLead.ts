import { list } from "@keystone-6/core";
import {
  text,
  float,
  calendarDay,
  select,
  relationship,
} from "@keystone-6/core/fields";
import { statusBusinessLeadAccess } from "./TechStatusBusinessLead.access";
import {
  PIPELINE_STATUS,
  OPPORTUNITY_LEVEL,
} from "../crm/constants";

const pipelineOptions = Object.entries(PIPELINE_STATUS).map(([k, v]) => ({
  label: v,
  value: v,
}));
const opportunityOptions = Object.entries(OPPORTUNITY_LEVEL).map(([k, v]) => ({
  label: v,
  value: v,
}));

export default list({
  access: statusBusinessLeadAccess,
  ui: {
    listView: {
      initialColumns: [
        "businessLead",
        "pipelineStatus",
        "opportunityLevel",
        "estimatedValue",
      ],
    },
  },
  fields: {
    businessLead: relationship({
      ref: "TechBusinessLead.status",
      many: false,
      ui: { description: "Lead de negocio asociado" },
    }),
    opportunityLevel: select({
      type: "string",
      options: opportunityOptions,
      defaultValue: "Media",
      isIndexed: true,
      ui: { description: "Nivel de oportunidad" },
    }),
    pipelineStatus: select({
      type: "string",
      options: pipelineOptions,
      defaultValue: PIPELINE_STATUS.DETECTADO,
      isIndexed: true,
      ui: { description: "Estado en el pipeline" },
    }),
    estimatedValue: float({
      ui: { description: "Valor estimado del proyecto" },
    }),
    productOffered: text({
      ui: { description: "Producto ofrecido (web, e-commerce, etc.)" },
    }),
    firstContactDate: calendarDay({
      ui: { description: "Fecha primer contacto" },
    }),
    nextFollowUpDate: calendarDay({
      ui: { description: "Próxima fecha de seguimiento" },
    }),
    notes: text({
      ui: { displayMode: "textarea", description: "Notas generales" },
    }),
  },
});
