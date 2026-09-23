import { KeystoneContext } from "@keystone-6/core/types";
import { resolveWhatsAppTarget } from "../../mutations/whatsapp/target";

const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * ¿Se le puede mandar texto libre a esta conversación, o hace falta la plantilla de inicio?
 * Sirve igual para un lead y para un chat interno con alguien del equipo: la ventana de 24h de
 * Meta aplica a cualquier número, sea cliente o compañero.
 */
const typeDefs = `
  type BusinessLeadWhatsappStatusResult {
    success: Boolean!
    message: String!
    canReplyFreely: Boolean!
    templateStatus: String
  }

  type Query {
    businessLeadWhatsappStatus(businessLeadId: ID, teamMemberId: ID): BusinessLeadWhatsappStatusResult!
  }
`;

const definition = `
  businessLeadWhatsappStatus(businessLeadId: ID, teamMemberId: ID): BusinessLeadWhatsappStatusResult!
`;

const resolver = {
  businessLeadWhatsappStatus: async (
    _root: unknown,
    {
      businessLeadId,
      teamMemberId,
    }: { businessLeadId?: string | null; teamMemberId?: string | null },
    context: KeystoneContext,
  ) => {
    const { target, error } = await resolveWhatsAppTarget(
      { businessLeadId, teamMemberId },
      context,
    );
    if (!target) {
      return {
        success: false,
        message: error ?? "No se pudo resolver la conversación",
        canReplyFreely: false,
        templateStatus: null,
      };
    }

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { id: target.companyId },
      query: "id whatsappTemplateStatus",
    });

    const conversationWhere = businessLeadId
      ? { businessLead: { id: { equals: businessLeadId } } }
      : { teamMember: { id: { equals: teamMemberId as string } } };

    const [lastInbound] = await context.sudo().query.TechWhatsAppMessage.findMany({
      where: { ...conversationWhere, direction: { equals: "inbound" } },
      orderBy: [{ createdAt: "desc" }],
      query: "createdAt",
      take: 1,
    });

    const canReplyFreely = lastInbound?.createdAt
      ? Date.now() - new Date(lastInbound.createdAt).getTime() <= REPLY_WINDOW_MS
      : false;

    return {
      success: true,
      message: "OK",
      canReplyFreely,
      templateStatus: company?.whatsappTemplateStatus ?? "none",
    };
  },
};

export default { typeDefs, definition, resolver };
