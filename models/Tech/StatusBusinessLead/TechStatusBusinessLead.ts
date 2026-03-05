import { graphql, list } from "@keystone-6/core";
import {
  text,
  float,
  calendarDay,
  select,
  relationship,
  virtual,
} from "@keystone-6/core/fields";
import { statusBusinessLeadAccess } from "./TechStatusBusinessLead.access";
import {
  PIPELINE_STATUS,
  OPPORTUNITY_LEVEL,
  FOLLOW_UP_TASK_STATUS,
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
    /** Virtual: next follow-up date from the latest FollowUpTask with status Pendiente or Pospuesto */
    nextFollowUpDate: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: { id: string; businessLeadId?: string | null }, _args, context) {
          let businessLeadId = item.businessLeadId;
          if (businessLeadId == null) {
            const s = await context.sudo().query.TechStatusBusinessLead.findOne({
              where: { id: item.id },
              query: "businessLead { id }",
            });
            businessLeadId = (s as { businessLead?: { id: string } } | null)?.businessLead?.id ?? null;
          }
          if (!businessLeadId) return null;
          const tasks = await context.sudo().query.TechFollowUpTask.findMany({
            where: {
              businessLead: { id: { equals: businessLeadId } },
              status: {
                in: [FOLLOW_UP_TASK_STATUS.PENDIENTE, FOLLOW_UP_TASK_STATUS.POSPUESTO],
              },
            },
            orderBy: [{ scheduledDate: "desc" }],
            take: 1,
            query: "scheduledDate",
          });
          const date = (tasks as { scheduledDate: string | null }[])[0]?.scheduledDate;
          return date ?? null;
        },
      }),
      ui: { description: "Próxima fecha de seguimiento (del último FollowUpTask Pendiente o Pospuesto)" },
    }),
    saasCompany: relationship({
      ref: "SaasCompany.techStatusBusinessLeads",
      many: false,
      ui: { description: "Empresa a la que pertenece el lead" },
    }),
    salesPerson: relationship({
      ref: "User.techStatusBusinessLeads",
      many: false,
      ui: { description: "Vendedor asignado" },
    }),
    notes: text({
      ui: { displayMode: "textarea", description: "Notas generales" },
    }),
  },
});
