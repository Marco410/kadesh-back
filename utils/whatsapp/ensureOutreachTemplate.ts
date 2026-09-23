import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../helpers/encryption";
import { createWhatsAppTemplate } from "../intregrations/whatsapp";

export const OUTREACH_TEMPLATE_NAME = "kadesh_primer_contacto";
export const OUTREACH_TEMPLATE_LANGUAGE = "es_MX";
const OUTREACH_TEMPLATE_BODY =
  "Hola {{1}}, te escribe {{2}}. ¿Tienes un momento para platicar?";

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
 */
export async function ensureOutreachTemplate(
  company: TemplateOwner,
  context: KeystoneContext,
): Promise<void> {
  if (company.whatsappTemplateStatus && company.whatsappTemplateStatus !== "none") return;
  if (!company.whatsappBusinessAccountId || !company.whatsappAccessTokenEncrypted) return;

  try {
    const accessToken = decrypt(company.whatsappAccessTokenEncrypted);
    const result = await createWhatsAppTemplate({
      wabaId: company.whatsappBusinessAccountId,
      accessToken,
      name: OUTREACH_TEMPLATE_NAME,
      language: OUTREACH_TEMPLATE_LANGUAGE,
      bodyText: OUTREACH_TEMPLATE_BODY,
    });

    await context.sudo().query.SaasCompany.updateOne({
      where: { id: company.id },
      data: {
        whatsappTemplateName: OUTREACH_TEMPLATE_NAME,
        whatsappTemplateLanguage: OUTREACH_TEMPLATE_LANGUAGE,
        whatsappTemplateStatus: result.status === "APPROVED" ? "approved" : "pending",
      },
    });
  } catch (err) {
    console.error(
      `[whatsapp] No se pudo crear la plantilla de inicio para la empresa ${company.id}:`,
      err,
    );
  }
}
