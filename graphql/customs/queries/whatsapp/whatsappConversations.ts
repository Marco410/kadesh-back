import { KeystoneContext } from "@keystone-6/core/types";
import {
  canUseCompanyWhatsapp,
  denyCompanyWhatsappUseMessage,
} from "../../mutations/whatsapp/access";

// Cuántos mensajes recientes de la empresa se recorren para armar la lista de conversaciones
// (una fila por lead, quedándonos con su mensaje más reciente). Suficiente para una bandeja
// de un solo número de WhatsApp por empresa; si algún día hace falta paginar de verdad, esto
// se vuelve el primer cuello de botella.
const MAX_MESSAGES_SCANNED = 500;

type ScannedMessage = {
  id: string;
  body: string | null;
  direction: string | null;
  createdAt: string | null;
  businessLead: { id: string; businessName: string | null } | null;
};

const typeDefs = `
  type WhatsAppConversationSummary {
    leadId: ID!
    leadName: String!
    lastMessageBody: String!
    lastMessageAt: String!
    lastMessageDirection: String!
  }

  type WhatsAppConversationsResult {
    success: Boolean!
    message: String!
    conversations: [WhatsAppConversationSummary!]!
  }

  type Query {
    whatsappConversations(companyId: ID!): WhatsAppConversationsResult!
  }
`;

const definition = `
  whatsappConversations(companyId: ID!): WhatsAppConversationsResult!
`;

const resolver = {
  whatsappConversations: async (
    _root: unknown,
    { companyId }: { companyId: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    if (!canUseCompanyWhatsapp(session, companyId)) {
      return {
        success: false,
        message: denyCompanyWhatsappUseMessage(session),
        conversations: [],
      };
    }

    // sudo: queremos TODAS las conversaciones de la empresa (cualquier miembro las ve), no
    // solo los leads propios de quien pregunta — el filtro de compañía de abajo ya acota
    // correctamente, canUseCompanyWhatsapp ya validó el acceso.
    const messages = (await context
      .sudo()
      .query.TechWhatsAppMessage.findMany({
        where: { company: { id: { equals: companyId } } },
        orderBy: [{ createdAt: "desc" }],
        take: MAX_MESSAGES_SCANNED,
        query: "id body direction createdAt businessLead { id businessName }",
      })) as ScannedMessage[];

    const seenLeadIds = new Set<string>();
    const conversations: Array<{
      leadId: string;
      leadName: string;
      lastMessageBody: string;
      lastMessageAt: string;
      lastMessageDirection: string;
    }> = [];

    for (const msg of messages) {
      const leadId = msg.businessLead?.id;
      if (!leadId || !msg.createdAt || seenLeadIds.has(leadId)) continue;
      seenLeadIds.add(leadId);
      conversations.push({
        leadId,
        leadName: msg.businessLead?.businessName || "Sin nombre",
        lastMessageBody: msg.body || "",
        lastMessageAt: msg.createdAt,
        lastMessageDirection: msg.direction || "unknown",
      });
    }

    return { success: true, message: "OK", conversations };
  },
};

export default { typeDefs, definition, resolver };
