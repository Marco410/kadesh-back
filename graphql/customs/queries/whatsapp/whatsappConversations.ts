import { KeystoneContext } from "@keystone-6/core/types";
import { phoneTail } from "../../../../utils/whatsapp/matchPhone";
import {
  canUseCompanyWhatsapp,
  denyCompanyWhatsappUseMessage,
} from "../../mutations/whatsapp/access";

// Cuántos mensajes recientes se recorren para armar la lista de conversaciones (una fila por
// lead / compañero de equipo, quedándonos con su mensaje más reciente). Suficiente para una
// bandeja de un solo número de WhatsApp por empresa; si algún día hace falta paginar de
// verdad, esto se vuelve el primer cuello de botella.
const MAX_MESSAGES_SCANNED = 500;

type ScannedMessage = {
  id: string;
  body: string | null;
  direction: string | null;
  createdAt: string | null;
  fromPhone: string | null;
  toPhone: string | null;
  senderLabel: string | null;
  businessLead: {
    id: string;
    businessName: string | null;
    phone: string | null;
    salesPerson: Array<{ id: string; name: string | null; lastName: string | null }> | null;
  } | null;
  teamMember: {
    id: string;
    name: string | null;
    lastName: string | null;
    phone: string | null;
  } | null;
};

const typeDefs = `
  type WhatsAppConversationSummary {
    """Id del lead (conversación con un cliente) — vacío en las conversaciones internas."""
    leadId: ID
    """Id del compañero de equipo — vacío en las conversaciones con clientes."""
    teamMemberId: ID
    """Últimos 10 dígitos del teléfono — solo en las conversaciones con un número que aún no es cliente."""
    phoneKey: String
    """lead | team | phone (número que aún no es cliente; solo lo ven los admins)."""
    kind: String!
    name: String!
    phone: String
    assignedToId: ID
    assignedToName: String
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

function fullName(
  person: { name: string | null; lastName: string | null } | null | undefined,
): string {
  if (!person) return "";
  return [person.name, person.lastName].filter(Boolean).join(" ");
}

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

    // SIN sudo a propósito: el filtro del list (`whatsappMessageScopedWhere`) es el que hace
    // que un vendedor solo vea los chats de sus leads asignados y sus chats internos, y que
    // los mensajes sin matchear queden solo para los admins.
    const messages = (await context.query.TechWhatsAppMessage.findMany({
      where: { company: { id: { equals: companyId } } },
      orderBy: [{ createdAt: "desc" }],
      take: MAX_MESSAGES_SCANNED,
      query:
        "id body direction createdAt fromPhone toPhone senderLabel businessLead { id businessName phone salesPerson { id name lastName } } teamMember { id name lastName phone }",
    })) as ScannedMessage[];

    const seenKeys = new Set<string>();
    const conversations: Array<Record<string, unknown>> = [];

    // Nombre por número: el primero (más reciente) que traiga nombre de perfil de WhatsApp.
    const phoneNames = new Map<string, string>();

    for (const msg of messages) {
      if (!msg.createdAt) continue;

      const leadId = msg.businessLead?.id ?? null;
      const teamMemberId = msg.teamMember?.id ?? null;

      // Sin lead ni compañero: un número que todavía no es cliente. Se agrupa por teléfono y
      // solo llega aquí para los admins (el filtro del list —whatsappMessageScopedWhere— ya
      // deja fuera estos mensajes a cualquier otro rol).
      const phoneKey = !leadId && !teamMemberId
        ? phoneTail(msg.fromPhone || msg.toPhone)
        : "";
      if (!leadId && !teamMemberId && phoneKey.length < 8) continue;

      const key = leadId ? `lead:${leadId}` : teamMemberId ? `team:${teamMemberId}` : `phone:${phoneKey}`;

      if (phoneKey && msg.senderLabel && !phoneNames.has(phoneKey)) {
        phoneNames.set(phoneKey, msg.senderLabel);
      }
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const assigned = msg.businessLead?.salesPerson?.[0] ?? null;
      const rawPhone = msg.fromPhone || msg.toPhone || null;

      conversations.push({
        leadId,
        teamMemberId,
        phoneKey: phoneKey || null,
        kind: leadId ? "lead" : teamMemberId ? "team" : "phone",
        name: leadId
          ? msg.businessLead?.businessName || "Sin nombre"
          : teamMemberId
            ? fullName(msg.teamMember) || "Sin nombre"
            : "", // se completa abajo con el nombre de perfil o el teléfono
        phone:
          (leadId
            ? msg.businessLead?.phone
            : teamMemberId
              ? msg.teamMember?.phone
              : rawPhone && `+${rawPhone.replace(/\D/g, "")}`) || null,
        assignedToId: assigned?.id ?? null,
        assignedToName: assigned ? fullName(assigned) || null : null,
        lastMessageBody: msg.body || "",
        lastMessageAt: msg.createdAt,
        lastMessageDirection: msg.direction || "unknown",
      });
    }

    for (const c of conversations) {
      if (c.kind === "phone") {
        c.name = phoneNames.get(c.phoneKey as string) || (c.phone as string) || "Número sin nombre";
      }
    }

    return { success: true, message: "OK", conversations };
  },
};

export default { typeDefs, definition, resolver };
