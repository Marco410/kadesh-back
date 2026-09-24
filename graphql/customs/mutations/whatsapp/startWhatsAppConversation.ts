import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../../../../utils/helpers/encryption";
import { sendWhatsAppTemplateMessage } from "../../../../utils/intregrations/whatsapp";
import { resolveWhatsAppTarget } from "./target";

const typeDefs = `
  type StartWhatsAppConversationResult {
    success: Boolean!
    message: String!
  }

  type Mutation {
    startWhatsAppConversation(businessLeadId: ID, teamMemberId: ID, phone: String): StartWhatsAppConversationResult!
  }
`;

const definition = `
  startWhatsAppConversation(businessLeadId: ID, teamMemberId: ID, phone: String): StartWhatsAppConversationResult!
`;

function toResult(success: boolean, message: string) {
  return { success, message };
}

const resolver = {
  startWhatsAppConversation: async (
    _root: unknown,
    {
      businessLeadId,
      teamMemberId,
      phone,
    }: {
      businessLeadId?: string | null;
      teamMemberId?: string | null;
      phone?: string | null;
    },
    context: KeystoneContext,
  ) => {
    const session = context.session;

    const { target, error } = await resolveWhatsAppTarget(
      { businessLeadId, teamMemberId, phone },
      context,
    );
    if (!target) return toResult(false, error ?? "No se pudo resolver el destinatario");

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { id: target.companyId },
      query:
        "id name whatsappPhoneNumberId whatsappAccessTokenEncrypted whatsappTemplateName whatsappTemplateLanguage whatsappTemplateStatus",
    });

    if (!company?.whatsappPhoneNumberId || !company?.whatsappAccessTokenEncrypted) {
      return toResult(false, "WhatsApp no está conectado para esta empresa");
    }

    if (company.whatsappTemplateStatus !== "approved" || !company.whatsappTemplateName) {
      const statusMessage =
        company.whatsappTemplateStatus === "rejected"
          ? "La plantilla para iniciar conversaciones fue rechazada por Meta. Contacta a soporte de Kadesh."
          : "La plantilla para iniciar conversaciones todavía está pendiente de aprobación de Meta. Intenta de nuevo en un rato.";
      return toResult(false, statusMessage);
    }

    const baseData = {
      company: { connect: { id: target.companyId } },
      ...target.link,
      direction: "outbound",
      messageKind: "template",
      toPhone: target.to,
      sentBy: session?.data?.id ? { connect: { id: session.data.id } } : undefined,
    };

    try {
      const accessToken = decrypt(company.whatsappAccessTokenEncrypted);
      await sendWhatsAppTemplateMessage({
        phoneNumberId: company.whatsappPhoneNumberId,
        accessToken,
        to: target.to,
        templateName: company.whatsappTemplateName,
        language: company.whatsappTemplateLanguage || "es_MX",
        bodyParams: [target.displayName, company.name],
      });

      const renderedBody = `Hola ${target.displayName}, te escribe ${company.name}. ¿Tienes un momento para platicar?`;

      await context.sudo().query.TechWhatsAppMessage.createOne({
        data: { ...baseData, body: renderedBody, status: "sent" },
      });

      return toResult(true, "Conversación iniciada");
    } catch (err) {
      await context.sudo().query.TechWhatsAppMessage.createOne({
        data: {
          ...baseData,
          body: "(plantilla de inicio de conversación)",
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Error desconocido",
        },
      });
      return toResult(
        false,
        err instanceof Error ? err.message : "No se pudo iniciar la conversación",
      );
    }
  },
};

export default { typeDefs, definition, resolver };
