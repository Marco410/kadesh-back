import { KeystoneContext } from "@keystone-6/core/types";
import { getSessionCompanyId } from "../../../../utils/access/tenant";
import { phoneTail } from "../../../../utils/whatsapp/matchPhone";
import {
  canManageCompanyWhatsapp,
  denyCompanyWhatsappAccessMessage,
} from "./access";

/**
 * "Guardar como cliente" de un número que escribió sin ser cliente: los mensajes que ya llegaron
 * (y las respuestas que se le mandaron) están guardados sin lead, así que al crear el cliente
 * hay que enlazarlos o se quedarían como una conversación "de número" separada del cliente.
 * Idempotente: repetirlo no cambia nada.
 *
 * Solo admin de empresa, igual que quien ve esas conversaciones. Solo toca mensajes de ESTA
 * empresa que no tengan ni lead ni compañero: nunca reasigna un chat que ya es de alguien.
 */
const typeDefs = `
  type LinkWhatsAppContactToLeadResult {
    success: Boolean!
    message: String!
    linked: Int!
  }

  type Mutation {
    linkWhatsAppContactToLead(businessLeadId: ID!, phone: String!): LinkWhatsAppContactToLeadResult!
  }
`;

const definition = `
  linkWhatsAppContactToLead(businessLeadId: ID!, phone: String!): LinkWhatsAppContactToLeadResult!
`;

function toResult(success: boolean, message: string, linked = 0) {
  return { success, message, linked };
}

const resolver = {
  linkWhatsAppContactToLead: async (
    _root: unknown,
    { businessLeadId, phone }: { businessLeadId: string; phone: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    const companyId = getSessionCompanyId(session);

    if (!companyId || !canManageCompanyWhatsapp(session, companyId)) {
      return toResult(false, denyCompanyWhatsappAccessMessage(session));
    }

    const tail = phoneTail(phone);
    if (tail.length < 8) return toResult(false, "Ese teléfono no es válido");

    const lead = await context.sudo().query.TechBusinessLead.findOne({
      where: { id: businessLeadId },
      query: "id saasCompany { id }",
    });
    const inCompany = (lead?.saasCompany ?? []).some(
      (c: { id: string }) => c.id === companyId,
    );
    if (!lead || !inCompany) return toResult(false, "No se encontró el cliente");

    // prisma directo: es una actualización masiva y esta list no tiene hooks que perder.
    const { count } = await context.sudo().prisma.techWhatsAppMessage.updateMany({
      where: {
        companyId,
        businessLeadId: null,
        teamMemberId: null,
        OR: [{ fromPhone: { endsWith: tail } }, { toPhone: { endsWith: tail } }],
      },
      data: { businessLeadId },
    });

    return toResult(true, "Conversación enlazada al cliente", count);
  },
};

export default { typeDefs, definition, resolver };
