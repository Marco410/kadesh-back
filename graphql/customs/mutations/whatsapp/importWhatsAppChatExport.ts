import { KeystoneContext } from "@keystone-6/core/types";
import { getSessionCompanyId } from "../../../../utils/access/tenant";
import { parseWhatsAppChatExport } from "../../../../utils/whatsapp/parseChatExport";
import { canUseCompanyWhatsapp, denyCompanyWhatsappUseMessage } from "./access";

const DEDUPE_LOOKBACK = 5000;

const typeDefs = `
  type ImportWhatsAppChatExportResult {
    success: Boolean!
    message: String!
    imported: Int!
    skippedDuplicates: Int!
  }

  type Mutation {
    importWhatsAppChatExport(
      businessLeadId: ID!
      fileName: String
      content: String!
      leadSenderName: String
    ): ImportWhatsAppChatExportResult!
  }
`;

const definition = `
  importWhatsAppChatExport(
    businessLeadId: ID!
    fileName: String
    content: String!
    leadSenderName: String
  ): ImportWhatsAppChatExportResult!
`;

function toResult(success: boolean, message: string, imported = 0, skippedDuplicates = 0) {
  return { success, message, imported, skippedDuplicates };
}

const resolver = {
  importWhatsAppChatExport: async (
    _root: unknown,
    {
      businessLeadId,
      content,
      leadSenderName,
    }: {
      businessLeadId: string;
      fileName?: string | null;
      content: string;
      leadSenderName?: string | null;
    },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    const companyId = getSessionCompanyId(session);

    const lead = await context.sudo().query.TechBusinessLead.findOne({
      where: { id: businessLeadId },
      query: "id saasCompany { id }",
    });
    if (!lead) {
      return toResult(false, "No se encontró el lead");
    }

    const leadCompanyIds: string[] = (lead.saasCompany ?? []).map((c: any) => c.id);
    const effectiveCompanyId = companyId && leadCompanyIds.includes(companyId) ? companyId : null;

    if (!effectiveCompanyId || !canUseCompanyWhatsapp(session, effectiveCompanyId)) {
      return toResult(false, denyCompanyWhatsappUseMessage(session));
    }

    let parsed;
    try {
      parsed = parseWhatsAppChatExport(content);
    } catch (err) {
      return toResult(false, err instanceof Error ? err.message : "No se pudo leer el archivo");
    }

    if (parsed.length === 0) {
      return toResult(false, "No se reconoció ningún mensaje en el archivo");
    }

    // Dedup: si ya se importó este archivo antes, no duplicar.
    const existing = await context.sudo().query.TechWhatsAppMessage.findMany({
      where: {
        businessLead: { id: { equals: businessLeadId } },
        source: { equals: "imported" },
      },
      query: "createdAt body",
      take: DEDUPE_LOOKBACK,
    });
    const existingKeys = new Set(
      existing.map((m: any) => `${new Date(m.createdAt).getTime()}|${m.body}`),
    );

    const normalizedLeadSender = leadSenderName?.trim() || null;

    const rows = parsed
      .map((msg) => ({
        key: `${msg.timestamp.getTime()}|${msg.body}`,
        msg,
      }))
      .filter(({ key }) => !existingKeys.has(key));

    const skippedDuplicates = parsed.length - rows.length;

    if (rows.length === 0) {
      return toResult(true, "No hay mensajes nuevos que importar (ya se habían importado)", 0, skippedDuplicates);
    }

    const data = rows.map(({ msg }) => {
      const direction = !normalizedLeadSender
        ? "unknown"
        : msg.sender === normalizedLeadSender
          ? "inbound"
          : "outbound";

      return {
        companyId: effectiveCompanyId,
        businessLeadId,
        direction,
        source: "imported",
        senderLabel: direction === "unknown" ? msg.sender : null,
        body: msg.body,
        status: direction === "outbound" ? "sent" : "received",
        createdAt: msg.timestamp,
      };
    });

    try {
      await context.sudo().prisma.techWhatsAppMessage.createMany({ data });
    } catch (err) {
      return toResult(
        false,
        err instanceof Error ? err.message : "No se pudo guardar el historial importado",
      );
    }

    return toResult(
      true,
      `${data.length} mensajes importados${skippedDuplicates ? `, ${skippedDuplicates} ya existían` : ""}`,
      data.length,
      skippedDuplicates,
    );
  },
};

export default { typeDefs, definition, resolver };
