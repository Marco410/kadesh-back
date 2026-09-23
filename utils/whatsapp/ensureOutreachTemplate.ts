import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../helpers/encryption";
import {
  createWhatsAppTemplate,
  fetchWhatsAppBusinessAccountInfo,
} from "../intregrations/whatsapp";

export const OUTREACH_TEMPLATE_NAME = "kadesh_primer_contacto";
export const OUTREACH_TEMPLATE_LANGUAGE = "es_MX";
const OUTREACH_TEMPLATE_BODY =
  "Hola {{1}}, te escribe {{2}}. ¿Tienes un momento para platicar?";
// Uno por variable, en orden ({{1}} nombre del lead, {{2}} nombre de la empresa). Meta los
// revisa: mejor que parezcan reales que "test" o "ejemplo".
const OUTREACH_TEMPLATE_EXAMPLES = ["Juan Pérez", "Kadesh"];

type TemplateOwner = {
  id: string;
  whatsappPhoneNumberId?: string | null;
  whatsappBusinessAccountId?: string | null;
  whatsappAccessTokenEncrypted?: string | null;
  whatsappTemplateStatus?: string | null;
};

/** Quita el prefijo interno `[whatsapp] Graph API error…:` para mostrarle al usuario solo lo de Meta. */
function cleanGraphMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Error desconocido";
  return raw.replace(/^\[whatsapp\] Graph API error( creando plantilla)?:\s*/, "");
}

/** Nombra la cuenta en el error: distingue, p. ej., la cuenta de prueba de Meta de una real. */
function withAccount(message: string, accountName: string | null): string {
  return accountName ? `${message} [Cuenta de WhatsApp Business: "${accountName}"]` : message;
}

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

  let accountName: string | null = null;

  try {
    const accessToken = decrypt(company.whatsappAccessTokenEncrypted);

    // Antes de crear nada: ¿ese ID es de la cuenta dueña del número conectado? Si no, la
    // plantilla se estaría intentando crear en otra cuenta y Meta responde con un error
    // genérico que no dice qué ID estaba mal.
    const account = await fetchWhatsAppBusinessAccountInfo({
      wabaId: company.whatsappBusinessAccountId,
      accessToken,
    });
    accountName = account.name || null;

    if (
      company.whatsappPhoneNumberId &&
      !account.phoneNumberIds.includes(company.whatsappPhoneNumberId)
    ) {
      return {
        error: `El WhatsApp Business Account ID que guardaste es de la cuenta "${
          account.name || account.id
        }", y esa cuenta no incluye el número que conectaste. Revisa que copiaste el ID de la cuenta (arriba a la derecha en Configuración de la API) y no otro.`,
      };
    }

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
    return { error: withAccount(cleanGraphMessage(err), accountName) };
  }
}
