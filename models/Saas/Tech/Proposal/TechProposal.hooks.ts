import { PROPOSAL_STATUS } from "../crm/constants";
import { PIPELINE_STATUS } from "../crm/constants";
import { validateTechStatusCrmInput } from "../../../../utils/validation/validateTechStatusCrm";
import { crmCalendarHooks } from "../../../../utils/googleCalendar/crmEvents";
import { getSessionCompanyId } from "../../../../utils/access/tenant";

/**
 * Cuando una propuesta pasa a "Aceptada", marcar el BusinessLead como "Cerrado Ganado".
 */
export const proposalHooks = {
  beforeOperation: crmCalendarHooks.beforeOperation,
  validateInput: async ({
    context,
    resolvedData,
    item,
    addValidationError,
  }: any) => {
    await validateTechStatusCrmInput({
      context,
      resolvedData,
      item,
      listKey: "TechProposal",
      addValidationError,
    });
  },
  afterOperation: async ({
    operation,
    item,
    resolvedData,
    context,
    listKey,
  }: any) => {
    if (listKey !== "TechProposal" || !item?.id) return;

    // Evento de calendario ligado a la propuesta (nunca lanza).
    await crmCalendarHooks.afterOperation({ operation, item, context, listKey });

    if (
      operation === "update" &&
      resolvedData?.status === PROPOSAL_STATUS.COMPRADA
    ) {
      const proposal = await context.query.TechProposal.findOne({
        where: { id: item.id },
        query: "id status businessLead { id } workspace { company { id } }",
      });
      if (
        !proposal?.businessLead?.id ||
        proposal.status !== PROPOSAL_STATUS.COMPRADA
      )
        return;

      // El estatus es uno por (lead, empresa): se mueve el de la empresa de la propuesta.
      const companyId =
        proposal.workspace?.company?.id ?? getSessionCompanyId(context.session);
      if (!companyId) return;

      try {
        const [status] = await context.sudo().query.TechStatusBusinessLead.findMany({
          where: {
            businessLead: { id: { equals: proposal.businessLead.id } },
            saasCompany: { id: { equals: companyId } },
          },
          take: 1,
          query: "id",
        });
        if (status?.id) {
          await context.db.TechStatusBusinessLead.updateOne({
            where: { id: status.id },
            data: { pipelineStatus: PIPELINE_STATUS.CERRADO_GANADO },
          });
        }
      } catch (e) {
        console.error("Error updating BusinessLead status to Cerrado Ganado:", e);
      }
    }
  },
};
