import {
  PIPELINE_STATUS,
  DEFAULT_FOLLOW_UP_DAYS_AFTER_PROPOSAL,
} from "../crm/constants";

/**
 * Al cambiar estado a "Propuesta Enviada", crear automáticamente una tarea de seguimiento.
 */
function getNextFollowUpDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_FOLLOW_UP_DAYS_AFTER_PROPOSAL);
  return d.toISOString().slice(0, 10);
}

export const businessLeadHooks = {
  afterOperation: async ({
    operation,
    item,
    resolvedData,
    context,
    listKey,
  }: any) => {
    if (listKey !== "TechBusinessLead" || !item?.id) return;

    if (
      operation === "update" &&
      resolvedData?.pipelineStatus === PIPELINE_STATUS.PROPUESTA_ENVIADA
    ) {
      const lead = await context.query.TechBusinessLead.findOne({
        where: { id: item.id },
        query: "id assignedSeller { id }",
      });
      const assignedSellerId =
        lead?.assignedSeller?.id ??
        resolvedData.assignedSeller?.connect?.[0]?.id;

      const [existingTask] = await context.query.TechFollowUpTask.findMany({
        where: {
          businessLead: { id: { equals: item.id } },
          status: { equals: "Pendiente" },
        },
        take: 1,
        query: "id",
      });
      if (existingTask) return;

      try {
        await context.db.TechFollowUpTask.createOne({
          data: {
            scheduledDate: getNextFollowUpDate(),
            status: "Pendiente",
            priority: "Alta",
            businessLead: { connect: { id: item.id } },
            ...(assignedSellerId && {
              assignedSeller: { connect: { id: assignedSellerId } },
            }),
          },
        });
      } catch (e) {
        console.error("Error creating follow-up task for BusinessLead:", e);
      }
    }
  },
};
