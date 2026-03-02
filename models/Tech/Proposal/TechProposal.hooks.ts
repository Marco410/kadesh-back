import { PROPOSAL_STATUS } from "../crm/constants";
import { PIPELINE_STATUS } from "../crm/constants";

/**
 * Cuando una propuesta pasa a "Aceptada", marcar el BusinessLead como "Cerrado Ganado".
 */
export const proposalHooks = {
  afterOperation: async ({
    operation,
    item,
    resolvedData,
    context,
    listKey,
  }: any) => {
    if (listKey !== "TechProposal" || !item?.id) return;

    if (
      operation === "update" &&
      resolvedData?.status === PROPOSAL_STATUS.ACEPTADA
    ) {
      const proposal = await context.query.TechProposal.findOne({
        where: { id: item.id },
        query: "id status businessLead { id }",
      });
      if (
        !proposal?.businessLead?.id ||
        proposal.status !== PROPOSAL_STATUS.ACEPTADA
      )
        return;

      try {
        await context.db.TechBusinessLead.updateOne({
          where: { id: proposal.businessLead.id },
          data: { pipelineStatus: PIPELINE_STATUS.CERRADO_GANADO },
        });
      } catch (e) {
        console.error("Error updating BusinessLead to Cerrado Ganado:", e);
      }
    }
  },
};
