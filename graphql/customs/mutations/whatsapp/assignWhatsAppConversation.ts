import { KeystoneContext } from "@keystone-6/core/types";
import { getSessionCompanyId } from "../../../../utils/access/tenant";
import {
  canManageCompanyWhatsapp,
  denyCompanyWhatsappAccessMessage,
} from "./access";

/**
 * Asignar un chat = asignar el lead a ese vendedor (`TechBusinessLead.salesPerson`). No hay un
 * campo de asignación propio de WhatsApp a propósito: el filtro de visibilidad de los mensajes
 * (`whatsappMessageScopedWhere`) ya cuelga de esa misma asignación, así que una sola fuente de
 * verdad evita que el chat y el lead queden en manos distintas.
 *
 * Solo admin de empresa (o admin de plataforma): un vendedor no puede auto-asignarse chats.
 */
const typeDefs = `
  type AssignWhatsAppConversationResult {
    success: Boolean!
    message: String!
  }

  type Mutation {
    assignWhatsAppConversation(businessLeadId: ID!, salesPersonId: ID): AssignWhatsAppConversationResult!
  }
`;

const definition = `
  assignWhatsAppConversation(businessLeadId: ID!, salesPersonId: ID): AssignWhatsAppConversationResult!
`;

function toResult(success: boolean, message: string) {
  return { success, message };
}

const resolver = {
  assignWhatsAppConversation: async (
    _root: unknown,
    {
      businessLeadId,
      salesPersonId,
    }: { businessLeadId: string; salesPersonId?: string | null },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    const companyId = getSessionCompanyId(session);

    const lead = await context.sudo().query.TechBusinessLead.findOne({
      where: { id: businessLeadId },
      query: "id businessName saasCompany { id }",
    });
    if (!lead) return toResult(false, "No se encontró el lead");

    const leadCompanyIds: string[] = (lead.saasCompany ?? []).map(
      (c: { id: string }) => c.id,
    );
    const effectiveCompanyId =
      companyId && leadCompanyIds.includes(companyId) ? companyId : null;

    if (!effectiveCompanyId || !canManageCompanyWhatsapp(session, effectiveCompanyId)) {
      return toResult(false, denyCompanyWhatsappAccessMessage(session));
    }

    if (salesPersonId) {
      const person = await context.sudo().query.User.findOne({
        where: { id: salesPersonId },
        query: "id name lastName company { id }",
      });
      if (!person || person.company?.id !== effectiveCompanyId) {
        return toResult(false, "Esa persona no es de tu empresa");
      }

      await context.sudo().query.TechBusinessLead.updateOne({
        where: { id: businessLeadId },
        data: { salesPerson: { set: [{ id: salesPersonId }] } },
      });

      const name = [person.name, person.lastName].filter(Boolean).join(" ");
      return toResult(true, `Chat asignado a ${name || "el vendedor"}`);
    }

    await context.sudo().query.TechBusinessLead.updateOne({
      where: { id: businessLeadId },
      data: { salesPerson: { set: [] } },
    });

    return toResult(true, "Chat sin asignar. Solo lo ven los administradores.");
  },
};

export default { typeDefs, definition, resolver };
