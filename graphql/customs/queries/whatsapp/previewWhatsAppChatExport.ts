import { KeystoneContext } from "@keystone-6/core/types";
import { isSignedIn } from "../../../../utils/access/tenant";
import { distinctSenders, parseWhatsAppChatExport } from "../../../../utils/whatsapp/parseChatExport";

const MAX_SENDERS_FOR_1TO1 = 5;

const typeDefs = `
  type PreviewWhatsAppChatExportResult {
    success: Boolean!
    message: String!
    messageCount: Int!
    senderNames: [String!]!
  }

  type Query {
    previewWhatsAppChatExport(content: String!): PreviewWhatsAppChatExportResult!
  }
`;

const definition = `
  previewWhatsAppChatExport(content: String!): PreviewWhatsAppChatExportResult!
`;

const resolver = {
  previewWhatsAppChatExport: async (
    _root: unknown,
    { content }: { content: string },
    context: KeystoneContext,
  ) => {
    if (!isSignedIn(context.session)) {
      return {
        success: false,
        message: "Debes iniciar sesión",
        messageCount: 0,
        senderNames: [],
      };
    }

    try {
      const parsed = parseWhatsAppChatExport(content);
      const senderNames = distinctSenders(parsed);

      if (parsed.length === 0) {
        return {
          success: false,
          message: "No se reconoció ningún mensaje en el archivo. ¿Es un .txt exportado de WhatsApp?",
          messageCount: 0,
          senderNames: [],
        };
      }

      const message =
        senderNames.length > MAX_SENDERS_FOR_1TO1
          ? `Se detectaron ${senderNames.length} remitentes distintos — probablemente no es un chat 1 a 1.`
          : `${parsed.length} mensajes detectados.`;

      return { success: true, message, messageCount: parsed.length, senderNames };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "No se pudo leer el archivo",
        messageCount: 0,
        senderNames: [],
      };
    }
  },
};

export default { typeDefs, definition, resolver };
