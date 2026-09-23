import { KeystoneContext } from "@keystone-6/core/types";
import {
  canManageCompanyWhatsapp,
  denyCompanyWhatsappAccessMessage,
} from "../../mutations/whatsapp/access";

/**
 * Datos del webhook (URL + Verify Token) que una empresa necesita para configurar SU App de
 * Meta. Ambos son globales (un solo webhook atiende a todas las empresas, ver
 * webhooks/whatsapp.ts), pero se sirven detrás de la misma autorización que el resto de la
 * config de WhatsApp — nunca hardcodeados en el front, ver models/README.md 2026-09-22.
 */
const typeDefs = `
  type CompanyWhatsappWebhookInfoResult {
    success: Boolean!
    message: String!
    webhookUrl: String
    verifyToken: String
  }

  type Query {
    companyWhatsappWebhookInfo(companyId: ID!): CompanyWhatsappWebhookInfoResult!
  }
`;

const definition = `
  companyWhatsappWebhookInfo(companyId: ID!): CompanyWhatsappWebhookInfoResult!
`;

const resolver = {
  companyWhatsappWebhookInfo: async (
    _root: unknown,
    { companyId }: { companyId: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    if (!canManageCompanyWhatsapp(session, companyId)) {
      return { success: false, message: denyCompanyWhatsappAccessMessage(session) };
    }

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
    const baseUrl = process.env.WHATSAPP_WEBHOOK_BASE_URL?.trim().replace(/\/+$/, "");

    if (!verifyToken || !baseUrl) {
      return {
        success: false,
        message:
          "Falta configurar WHATSAPP_WEBHOOK_VERIFY_TOKEN o WHATSAPP_WEBHOOK_BASE_URL en el backend",
      };
    }

    return {
      success: true,
      message: "OK",
      webhookUrl: `${baseUrl}/webhooks/whatsapp`,
      verifyToken,
    };
  },
};

export default { typeDefs, definition, resolver };
