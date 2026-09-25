import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../../../../utils/helpers/encryption";
import { sendWhatsAppTextMessage } from "../../../../utils/intregrations/whatsapp";
import { resolveWhatsAppTarget } from "./target";

const typeDefs = `
  type SendWhatsAppMessageResult {
    success: Boolean!
    message: String!
    messageId: String
  }

  type Mutation {
    sendWhatsAppMessage(businessLeadId: ID, teamMemberId: ID, phone: String, body: String!): SendWhatsAppMessageResult!
  }
`;

const definition = `
  sendWhatsAppMessage(businessLeadId: ID, teamMemberId: ID, phone: String, body: String!): SendWhatsAppMessageResult!
`;

const resolver = {
  sendWhatsAppMessage: async (
    _root: unknown,
    {
      businessLeadId,
      teamMemberId,
      phone,
      body,
    }: {
      businessLeadId?: string | null;
      teamMemberId?: string | null;
      phone?: string | null;
      body: string;
    },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    const trimmedBody = body.trim();

    if (!trimmedBody) {
      return { success: false, message: "El mensaje no puede estar vacío" };
    }

    const { target, error } = await resolveWhatsAppTarget(
      { businessLeadId, teamMemberId, phone },
      context,
    );
    if (!target) return { success: false, message: error };

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { id: target.companyId },
      query: "id whatsappPhoneNumberId whatsappAccessTokenEncrypted",
    });

    if (!company?.whatsappPhoneNumberId || !company?.whatsappAccessTokenEncrypted) {
      return { success: false, message: "WhatsApp no está conectado para esta empresa" };
    }

    const baseData = {
      company: { connect: { id: target.companyId } },
      ...target.link,
      direction: "outbound",
      toPhone: target.to,
      body: trimmedBody,
      sentBy: session?.data?.id ? { connect: { id: session.data.id } } : undefined,
    };

    try {
      const accessToken = decrypt(company.whatsappAccessTokenEncrypted);
      const result = await sendWhatsAppTextMessage({
        phoneNumberId: company.whatsappPhoneNumberId,
        accessToken,
        to: target.to,
        body: trimmedBody,
      });

      await context.sudo().query.TechWhatsAppMessage.createOne({
        data: { ...baseData, waMessageId: result.id, status: "sent" },
      });

      return { success: true, message: "Mensaje enviado", messageId: result.id };
    } catch (err) {
      const graphCode = (err as { graphCode?: number })?.graphCode;
      const isOutsideWindow = graphCode === 131047;

      await context.sudo().query.TechWhatsAppMessage.createOne({
        data: {
          ...baseData,
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Error desconocido",
        },
      });

      return {
        success: false,
        message: isOutsideWindow
          ? "Han pasado más de 24h desde el último mensaje. Usa \"Iniciar conversación\" para mandar la plantilla aprobada."
          : err instanceof Error
            ? err.message
            : "Error al enviar el mensaje",
      };
    }
  },
};

export default { typeDefs, definition, resolver };
