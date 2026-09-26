import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../../../../utils/helpers/encryption";
import {
  listWhatsAppTemplates,
  sendWhatsAppTemplateMessage,
  type WhatsAppTemplateSummary,
} from "../../../../utils/intregrations/whatsapp";
import { resolveWhatsAppTarget } from "./target";

const typeDefs = `
  type StartWhatsAppConversationResult {
    success: Boolean!
    message: String!
  }

  type Mutation {
    startWhatsAppConversation(businessLeadId: ID, teamMemberId: ID, phone: String, templateName: String, templateLanguage: String, templateParams: [String!]): StartWhatsAppConversationResult!
  }
`;

const definition = `
  startWhatsAppConversation(businessLeadId: ID, teamMemberId: ID, phone: String, templateName: String, templateLanguage: String, templateParams: [String!]): StartWhatsAppConversationResult!
`;

function toResult(success: boolean, message: string) {
  return { success, message };
}

/** Sustituye `{{1}}`, `{{2}}`… por los valores que se mandaron, para guardar lo que de verdad leyó el destinatario. */
function renderTemplateBody(bodyText: string, params: string[]): string {
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, index) => {
    const value = params[Number(index) - 1];
    return value === undefined ? match : value;
  });
}

const resolver = {
  startWhatsAppConversation: async (
    _root: unknown,
    {
      businessLeadId,
      teamMemberId,
      phone,
      templateName,
      templateLanguage,
      templateParams,
    }: {
      businessLeadId?: string | null;
      teamMemberId?: string | null;
      phone?: string | null;
      templateName?: string | null;
      templateLanguage?: string | null;
      templateParams?: string[] | null;
    },
    context: KeystoneContext,
  ) => {
    const session = context.session;

    const { target, error } = await resolveWhatsAppTarget(
      { businessLeadId, teamMemberId, phone },
      context,
    );
    if (!target) return toResult(false, error ?? "No se pudo resolver el destinatario");

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { id: target.companyId },
      query:
        "id name whatsappPhoneNumberId whatsappBusinessAccountId whatsappAccessTokenEncrypted whatsappTemplateName whatsappTemplateLanguage whatsappTemplateStatus",
    });

    if (!company?.whatsappPhoneNumberId || !company?.whatsappAccessTokenEncrypted) {
      return toResult(false, "WhatsApp no está conectado para esta empresa");
    }

    const accessToken = decrypt(company.whatsappAccessTokenEncrypted);
    const requestedName = templateName?.trim() || null;

    // Plantilla elegida a mano: se valida contra Meta, que es donde vive la verdad sobre si
    // sigue aprobada y cuántas variables pide. Sin esto, un desfase entre lo que ve el usuario
    // y lo que tiene Meta se traduce en un error críptico de la Graph API al enviar.
    let chosen: WhatsAppTemplateSummary | null = null;

    if (requestedName) {
      if (!company.whatsappBusinessAccountId) {
        return toResult(false, "Falta el WhatsApp Business Account ID de la empresa");
      }
      try {
        const candidates = await listWhatsAppTemplates({
          wabaId: company.whatsappBusinessAccountId,
          accessToken,
          name: requestedName,
        });
        const exact = candidates.filter((t) => t.name === requestedName);
        chosen =
          (templateLanguage && exact.find((t) => t.language === templateLanguage)) ||
          exact[0] ||
          null;
      } catch (err) {
        return toResult(
          false,
          err instanceof Error
            ? err.message.replace(/^\[whatsapp\] Graph API error[^:]*:\s*/, "")
            : "No se pudo leer la plantilla en Meta",
        );
      }

      if (!chosen) {
        return toResult(false, `La plantilla "${requestedName}" ya no existe en tu cuenta de Meta`);
      }
      if (chosen.status !== "APPROVED") {
        return toResult(
          false,
          `La plantilla "${requestedName}" no está aprobada por Meta (estado: ${chosen.status})`,
        );
      }
    } else if (company.whatsappTemplateStatus !== "approved" || !company.whatsappTemplateName) {
      const statusMessage =
        company.whatsappTemplateStatus === "rejected"
          ? "La plantilla para iniciar conversaciones fue rechazada por Meta. Contacta a soporte de Kadesh."
          : "La plantilla para iniciar conversaciones todavía está pendiente de aprobación de Meta. Intenta de nuevo en un rato.";
      return toResult(false, statusMessage);
    }

    // Los valores por defecto sólo aplican a la plantilla que crea Kadesh ({{1}} destinatario,
    // {{2}} empresa). Para una plantilla propia, los manda quien la elige.
    const params = chosen
      ? (templateParams ?? []).map((p) => p.trim())
      : [target.displayName, company.name];

    if (chosen && params.length !== chosen.variableCount) {
      return toResult(
        false,
        `La plantilla "${chosen.name}" pide ${chosen.variableCount} dato(s) y se mandaron ${params.length}`,
      );
    }
    if (params.some((p) => !p)) {
      return toResult(false, "Faltan datos por llenar en la plantilla");
    }

    const sendName = chosen?.name ?? (company.whatsappTemplateName as string);
    const sendLanguage =
      chosen?.language || company.whatsappTemplateLanguage || "es_MX";

    const baseData = {
      company: { connect: { id: target.companyId } },
      ...target.link,
      direction: "outbound",
      messageKind: "template",
      toPhone: target.to,
      sentBy: session?.data?.id ? { connect: { id: session.data.id } } : undefined,
    };

    try {
      await sendWhatsAppTemplateMessage({
        phoneNumberId: company.whatsappPhoneNumberId,
        accessToken,
        to: target.to,
        templateName: sendName,
        language: sendLanguage,
        bodyParams: params,
      });

      const renderedBody = chosen
        ? renderTemplateBody(chosen.bodyText, params)
        : `Hola ${target.displayName}, te escribe ${company.name}. ¿Tienes un momento para platicar?`;

      await context.sudo().query.TechWhatsAppMessage.createOne({
        data: { ...baseData, body: renderedBody, status: "sent" },
      });

      return toResult(true, "Conversación iniciada");
    } catch (err) {
      await context.sudo().query.TechWhatsAppMessage.createOne({
        data: {
          ...baseData,
          body: `(plantilla "${sendName}")`,
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Error desconocido",
        },
      });
      return toResult(
        false,
        err instanceof Error ? err.message : "No se pudo iniciar la conversación",
      );
    }
  },
};

export default { typeDefs, definition, resolver };
