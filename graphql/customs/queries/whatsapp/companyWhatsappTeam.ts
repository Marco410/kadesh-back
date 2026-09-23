import { KeystoneContext } from "@keystone-6/core/types";
import {
  canUseCompanyWhatsapp,
  denyCompanyWhatsappUseMessage,
} from "../../mutations/whatsapp/access";
import { getSessionUserId } from "../../../../utils/access/tenant";

/**
 * Compañeros de equipo a los que se les puede escribir por WhatsApp (y, para los admins, a
 * quienes se les puede asignar un chat). Existe como query propia porque el list de `User` no
 * deja que un vendedor lea el perfil de otro (ver User.access.ts) y aquí sí hace falta esa
 * lista acotada: solo gente de su misma empresa, solo id/nombre/teléfono.
 */
const typeDefs = `
  type WhatsAppTeamMember {
    id: ID!
    name: String!
    phone: String
    canReceiveWhatsapp: Boolean!
  }

  type CompanyWhatsappTeamResult {
    success: Boolean!
    message: String!
    members: [WhatsAppTeamMember!]!
  }

  type Query {
    companyWhatsappTeam(companyId: ID!): CompanyWhatsappTeamResult!
  }
`;

const definition = `
  companyWhatsappTeam(companyId: ID!): CompanyWhatsappTeamResult!
`;

type TeamUser = {
  id: string;
  name: string | null;
  lastName: string | null;
  phone: string | null;
};

const resolver = {
  companyWhatsappTeam: async (
    _root: unknown,
    { companyId }: { companyId: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    if (!canUseCompanyWhatsapp(session, companyId)) {
      return {
        success: false,
        message: denyCompanyWhatsappUseMessage(session),
        members: [],
      };
    }

    const sessionUserId = getSessionUserId(session);

    const users = (await context.sudo().query.User.findMany({
      where: { company: { id: { equals: companyId } } },
      orderBy: [{ name: "asc" }],
      take: 300,
      query: "id name lastName phone",
    })) as TeamUser[];

    const members = users
      // Escribirse a uno mismo por el número de la empresa no tiene sentido.
      .filter((u) => u.id !== sessionUserId)
      .map((u) => ({
        id: u.id,
        name: [u.name, u.lastName].filter(Boolean).join(" ") || "Sin nombre",
        phone: u.phone || null,
        canReceiveWhatsapp: Boolean(u.phone && u.phone.replace(/\D/g, "").length >= 10),
      }));

    return { success: true, message: "OK", members };
  },
};

export default { typeDefs, definition, resolver };
