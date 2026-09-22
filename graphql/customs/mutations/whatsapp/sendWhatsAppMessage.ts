import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../../../../utils/helpers/encryption";
import { sendWhatsAppTextMessage } from "../../../../utils/intregrations/whatsapp";
import { getSessionCompanyId } from "../../../../utils/access/tenant";
import { canUseCompanyWhatsapp, denyCompanyWhatsappUseMessage } from "./access";

const typeDefs = `
  type SendWhatsAppMessageResult {
    success: Boolean!
    message: String!
    messageId: String
  }

  type Mutation {
    sendWhatsAppMessage(businessLeadId: ID!, body: String!): SendWhatsAppMessageResult!
  }
`;

const definition = `
  sendWhatsAppMessage(businessLeadId: ID!, body: String!): SendWhatsAppMessageResult!
`;

/** Mismo criterio que `whatsappDigitsFromPhone` del front (DetailLeadSection.tsx): sin +/espacios/
 * guiones, y si son 10 dígitos (formato local MX) se asume lada 52. */
function normalizeWhatsAppDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

const resolver = {
  sendWhatsAppMessage: async (
    _root: unknown,
    { businessLeadId, body }: { businessLeadId: string; body: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    const companyId = getSessionCompanyId(session);
    const trimmedBody = body.trim();

    if (!trimmedBody) {
      return { success: false, message: "El mensaje no puede estar vacío" };
    }
    if (!companyId && !session?.data?.id) {
      return { success: false, message: denyCompanyWhatsappUseMessage(session) };
    }

    const lead = await context.sudo().query.TechBusinessLead.findOne({
      where: { id: businessLeadId },
      query: "id phone businessName saasCompany { id }",
    });

    if (!lead) {
      return { success: false, message: "No se encontró el lead" };
    }

    const leadCompanyIds: string[] = (lead.saasCompany ?? []).map((c: any) => c.id);
    const effectiveCompanyId = companyId && leadCompanyIds.includes(companyId)
      ? companyId
      : null;

    if (!effectiveCompanyId || !canUseCompanyWhatsapp(session, effectiveCompanyId)) {
      return { success: false, message: denyCompanyWhatsappUseMessage(session) };
    }

    const to = lead.phone ? normalizeWhatsAppDigits(lead.phone) : null;
    if (!to) {
      return { success: false, message: "Este lead no tiene un teléfono válido" };
    }

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { id: effectiveCompanyId },
      query: "id whatsappPhoneNumberId whatsappAccessTokenEncrypted",
    });

    if (!company?.whatsappPhoneNumberId || !company?.whatsappAccessTokenEncrypted) {
      return { success: false, message: "WhatsApp no está conectado para esta empresa" };
    }

    try {
      const accessToken = decrypt(company.whatsappAccessTokenEncrypted);
      const result = await sendWhatsAppTextMessage({
        phoneNumberId: company.whatsappPhoneNumberId,
        accessToken,
        to,
        body: trimmedBody,
      });

      await context.sudo().query.TechWhatsAppMessage.createOne({
        data: {
          company: { connect: { id: effectiveCompanyId } },
          businessLead: { connect: { id: businessLeadId } },
          direction: "outbound",
          waMessageId: result.id,
          toPhone: to,
          body: trimmedBody,
          status: "sent",
          sentBy: session?.data?.id ? { connect: { id: session.data.id } } : undefined,
        },
      });

      return { success: true, message: "Mensaje enviado", messageId: result.id };
    } catch (err) {
      const graphCode = (err as { graphCode?: number })?.graphCode;
      const isOutsideWindow = graphCode === 131047;

      await context.sudo().query.TechWhatsAppMessage.createOne({
        data: {
          company: { connect: { id: effectiveCompanyId } },
          businessLead: { connect: { id: businessLeadId } },
          direction: "outbound",
          toPhone: to,
          body: trimmedBody,
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Error desconocido",
          sentBy: session?.data?.id ? { connect: { id: session.data.id } } : undefined,
        },
      });

      return {
        success: false,
        message: isOutsideWindow
          ? "Han pasado más de 24h desde el último mensaje del lead. Se necesita una plantilla aprobada (no soportado todavía)."
          : err instanceof Error
            ? err.message
            : "Error al enviar el mensaje",
      };
    }
  },
};

export default { typeDefs, definition, resolver };
