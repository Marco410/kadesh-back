import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../helpers/encryption";
import { createWhatsAppTemplate } from "../intregrations/whatsapp";

export const OUTREACH_TEMPLATE_NAME = "kadesh_primer_contacto";
export const OUTREACH_TEMPLATE_LANGUAGE = "es_MX";
const OUTREACH_TEMPLATE_BODY =
  "Hola {{1}}, te escribe {{2}}. ¿Tienes un momento para platicar?";
// Uno por variable, en orden ({{1}} nombre del lead, {{2}} nombre de la empresa). Meta los
// revisa: mejor que parezcan reales que "test" o "ejemplo".
const OUTREACH_TEMPLATE_EXAMPLES = ["Juan Pérez", "Kadesh"];

type TemplateOwner = {
  id: string;
  whatsappBusinessAccountId?: string | null;
  whatsappAccessTokenEncrypted?: string | null;
  whatsappTemplateStatus?: string | null;
};

/**
 * Crea (una sola vez por empresa) la plantilla que permite iniciarle una conversación a un lead
 * nuevo — Meta la exige, no hay forma de evitarla con la API oficial. Se llama best-effort desde
 * `testCompanyWhatsappConnection`: si falla, no rompe esa mutación, solo se reintenta la próxima
 * vez que prueben la conexión (sigue en `whatsappTemplateStatus: "none"`).
 *
 * Devuelve el motivo del fallo (el mensaje de Meta) en vez de tragárselo en un console.error:
 * es la única forma de que el usuario sepa POR QUÉ no se creó (permiso faltante del token,
 * WABA equivocado, plantilla ya existente…) sin abrir los logs del servidor.
 */
export async function ensureOutreachTemplate(
  company: TemplateOwner,
  context: KeystoneContext,
): Promise<{ error: string | null }> {
  if (company.whatsappTemplateStatus && company.whatsappTemplateStatus !== "none") {
    return { error: null };
  }
  if (!company.whatsappBusinessAccountId) {
    return { error: "Falta el WhatsApp Business Account ID." };
  }
  if (!company.whatsappAccessTokenEncrypted) {
    return { error: "Falta el access token." };
  }

  try {
    const accessToken = decrypt(company.whatsappAccessTokenEncrypted);
    const result = await createWhatsAppTemplate({
      wabaId: company.whatsappBusinessAccountId,
      accessToken,
      name: OUTREACH_TEMPLATE_NAME,
      language: OUTREACH_TEMPLATE_LANGUAGE,
      bodyText: OUTREACH_TEMPLATE_BODY,
      bodyExamples: OUTREACH_TEMPLATE_EXAMPLES,
    });

    await context.sudo().query.SaasCompany.updateOne({
      where: { id: company.id },
      data: {
        whatsappTemplateName: OUTREACH_TEMPLATE_NAME,
        whatsappTemplateLanguage: OUTREACH_TEMPLATE_LANGUAGE,
        whatsappTemplateStatus: result.status === "APPROVED" ? "approved" : "pending",
      },
    });
    return { error: null };
  } catch (err) {
    console.error(
      `[whatsapp] No se pudo crear la plantilla de inicio para la empresa ${company.id}:`,
      err,
    );
    const raw = err instanceof Error ? err.message : "Error desconocido";
    return { error: raw.replace(/^\[whatsapp\] Graph API error creando plantilla:\s*/, "") };
  }
}
