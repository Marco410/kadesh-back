import { KeystoneContext } from "@keystone-6/core/types";
import { getSessionCompanyId } from "../../../../utils/access/tenant";
import { canUseCompanyWhatsapp } from "../../mutations/whatsapp/access";

const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

const typeDefs = `
  type BusinessLeadWhatsappStatusResult {
    success: Boolean!
    message: String!
    canReplyFreely: Boolean!
    templateStatus: String
  }

  type Query {
    businessLeadWhatsappStatus(businessLeadId: ID!): BusinessLeadWhatsappStatusResult!
  }
`;

const definition = `
  businessLeadWhatsappStatus(businessLeadId: ID!): BusinessLeadWhatsappStatusResult!
`;

const resolver = {
  businessLeadWhatsappStatus: async (
    _root: unknown,
    { businessLeadId }: { businessLeadId: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    const companyId = getSessionCompanyId(session);

    const lead = await context.sudo().query.TechBusinessLead.findOne({
      where: { id: businessLeadId },
      query: "id saasCompany { id }",
    });
    if (!lead) {
      return { success: false, message: "No se encontró el lead", canReplyFreely: false, templateStatus: null };
    }

    const leadCompanyIds: string[] = (lead.saasCompany ?? []).map((c: any) => c.id);
    const effectiveCompanyId =
      companyId && leadCompanyIds.includes(companyId) ? companyId : null;

    if (!effectiveCompanyId || !canUseCompanyWhatsapp(session, effectiveCompanyId)) {
      return {
        success: false,
        message: "No tienes acceso a WhatsApp de esta empresa",
        canReplyFreely: false,
        templateStatus: null,
      };
    }

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { id: effectiveCompanyId },
      query: "id whatsappTemplateStatus",
    });

    const [lastInbound] = await context.sudo().query.TechWhatsAppMessage.findMany({
      where: {
        businessLead: { id: { equals: businessLeadId } },
        direction: { equals: "inbound" },
      },
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
