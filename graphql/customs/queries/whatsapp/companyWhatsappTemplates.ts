import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../../../../utils/helpers/encryption";
import { listWhatsAppTemplates } from "../../../../utils/intregrations/whatsapp";
import { canUseCompanyWhatsapp } from "../../mutations/whatsapp/access";
import { resolveWhatsAppTarget } from "../../mutations/whatsapp/target";

/**
 * Catálogo de plantillas aprobadas de la empresa, para que quien inicia una conversación elija
 * cuál mandar en vez de estar atado a la única que crea Kadesh.
 *
 * Se lee en vivo de Meta y no se guarda: el estado de una plantilla cambia del lado de Meta
 * (aprobación, pausa por calidad, borrado) y una copia local volvería a tener el mismo problema
 * de desincronización que ya tuvimos con `whatsappTemplateStatus`.
 */
const typeDefs = `
  type WhatsappTemplateOption {
    name: String!
    language: String!
    category: String!
    """Encabezado, sólo si es de texto."""
    headerText: String
    bodyText: String!
    footerText: String
    """Cuántas {{n}} hay que rellenar en el cuerpo."""
    variableCount: Int!
  }

  type CompanyWhatsappTemplatesResult {
    success: Boolean!
    message: String!
    templates: [WhatsappTemplateOption!]!
    """Nombre del destinatario y de la empresa, para proponer valores de las variables."""
    recipientName: String
    companyName: String
  }

  type Query {
    companyWhatsappTemplates(companyId: ID, businessLeadId: ID, teamMemberId: ID, phone: String): CompanyWhatsappTemplatesResult!
  }
`;

const definition = `
  companyWhatsappTemplates(companyId: ID, businessLeadId: ID, teamMemberId: ID, phone: String): CompanyWhatsappTemplatesResult!
`;

function fail(message: string) {
  return { success: false, message, templates: [], recipientName: null, companyName: null };
}

const resolver = {
  companyWhatsappTemplates: async (
    _root: unknown,
    {
      companyId,
      businessLeadId,
      teamMemberId,
      phone,
    }: {
      companyId?: string | null;
      businessLeadId?: string | null;
      teamMemberId?: string | null;
      phone?: string | null;
    },
    context: KeystoneContext,
  ) => {
    // Desde el chat no siempre se tiene el companyId a mano, pero sí el destinatario; es la
    // misma pareja de argumentos que `businessLeadWhatsappStatus`, para no obligar al panel a
    // acarrear la empresa por props.
    let resolvedCompanyId = companyId ?? null;
    let recipientName: string | null = null;

    if (businessLeadId || teamMemberId || phone) {
      const { target, error } = await resolveWhatsAppTarget(
        { businessLeadId, teamMemberId, phone },
        context,
      );
      if (!target && !resolvedCompanyId) {
        return fail(error ?? "No se pudo resolver la conversación");
      }
      if (target) {
        resolvedCompanyId = resolvedCompanyId ?? target.companyId;
        recipientName = target.displayName;
      }
    }

    if (!resolvedCompanyId) return fail("Falta indicar la empresa o la conversación");

    if (!canUseCompanyWhatsapp(context.session, resolvedCompanyId)) {
      return fail("No tienes acceso al WhatsApp de esta empresa");
    }

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { id: resolvedCompanyId },
      query: "id name whatsappBusinessAccountId whatsappAccessTokenEncrypted",
    });

    if (!company?.whatsappBusinessAccountId || !company?.whatsappAccessTokenEncrypted) {
      return fail("WhatsApp no está conectado para esta empresa");
    }

    try {
      const templates = await listWhatsAppTemplates({
        wabaId: company.whatsappBusinessAccountId,
        accessToken: decrypt(company.whatsappAccessTokenEncrypted),
      });

      // Sólo las que se pueden mandar hoy. Una plantilla con encabezado de imagen o documento
      // necesita un parámetro de media que todavía no pedimos, así que se deja fuera en vez de
      // ofrecerla y fallar al enviar.
      const usable = templates
        .filter((t) => t.status === "APPROVED" && t.bodyText)
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        success: true,
        message: "OK",
        templates: usable,
        recipientName,
        companyName: company.name ?? null,
      };
    } catch (err) {
      console.error(
        `[whatsapp] No se pudieron listar las plantillas de la empresa ${resolvedCompanyId}:`,
        err,
      );
      return fail(
        err instanceof Error
          ? err.message.replace(/^\[whatsapp\] Graph API error[^:]*:\s*/, "")
          : "No se pudieron leer las plantillas de Meta",
      );
    }
  },
};

export default { typeDefs, definition, resolver };
