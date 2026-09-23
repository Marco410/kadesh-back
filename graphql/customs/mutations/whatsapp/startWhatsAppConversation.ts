import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../../../../utils/helpers/encryption";
import { sendWhatsAppTemplateMessage } from "../../../../utils/intregrations/whatsapp";
import { getSessionCompanyId } from "../../../../utils/access/tenant";
import { canUseCompanyWhatsapp, denyCompanyWhatsappUseMessage } from "./access";

const typeDefs = `
  type StartWhatsAppConversationResult {
    success: Boolean!
    message: String!
  }

  type Mutation {
    startWhatsAppConversation(businessLeadId: ID!): StartWhatsAppConversationResult!
  }
`;

const definition = `
  startWhatsAppConversation(businessLeadId: ID!): StartWhatsAppConversationResult!
`;

function toResult(success: boolean, message: string) {
  return { success, message };
}

const resolver = {
  startWhatsAppConversation: async (
    _root: unknown,
    { businessLeadId }: { businessLeadId: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    const companyId = getSessionCompanyId(session);

    const lead = await context.sudo().query.TechBusinessLead.findOne({
      where: { id: businessLeadId },
      query: "id phone businessName saasCompany { id }",
    });
    if (!lead) return toResult(false, "No se encontró el lead");

    const leadCompanyIds: string[] = (lead.saasCompany ?? []).map((c: any) => c.id);
    const effectiveCompanyId =
      companyId && leadCompanyIds.includes(companyId) ? companyId : null;

    if (!effectiveCompanyId || !canUseCompanyWhatsapp(session, effectiveCompanyId)) {
      return toResult(false, denyCompanyWhatsappUseMessage(session));
    }

    const to = lead.phone ? lead.phone.replace(/\D/g, "") : null;
    if (!to) return toResult(false, "Este lead no tiene un teléfono válido");
    const normalizedTo = to.length === 10 ? `52${to}` : to;

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { id: effectiveCompanyId },
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

    // Meta rechaza parámetros de plantilla vacíos, así que hace falta un relleno si el lead no
    // tiene nombre guardado.
    const leadName = lead.businessName?.trim() || "estimado(a)";

    try {
      const accessToken = decrypt(company.whatsappAccessTokenEncrypted);
      await sendWhatsAppTemplateMessage({
        phoneNumberId: company.whatsappPhoneNumberId,
        accessToken,
        to: normalizedTo,
        templateName: company.whatsappTemplateName,
        language: company.whatsappTemplateLanguage || "es_MX",
        bodyParams: [leadName, company.name],
      });

      const renderedBody = `Hola ${leadName}, te escribe ${company.name}. ¿Tienes un momento para platicar?`;

      await context.sudo().query.TechWhatsAppMessage.createOne({
        data: {
          company: { connect: { id: effectiveCompanyId } },
          businessLead: { connect: { id: businessLeadId } },
          direction: "outbound",
          messageKind: "template",
          toPhone: normalizedTo,
          body: renderedBody,
          status: "sent",
          sentBy: session?.data?.id ? { connect: { id: session.data.id } } : undefined,
        },
      });

      return toResult(true, "Conversación iniciada");
    } catch (err) {
      await context.sudo().query.TechWhatsAppMessage.createOne({
        data: {
          company: { connect: { id: effectiveCompanyId } },
          businessLead: { connect: { id: businessLeadId } },
          direction: "outbound",
          messageKind: "template",
          toPhone: normalizedTo,
          body: "(plantilla de inicio de conversación)",
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Error desconocido",
          sentBy: session?.data?.id ? { connect: { id: session.data.id } } : undefined,
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
