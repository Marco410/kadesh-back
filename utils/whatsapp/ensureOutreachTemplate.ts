import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../helpers/encryption";
import {
  createWhatsAppTemplate,
  fetchWhatsAppBusinessAccountInfo,
  fetchWhatsAppTemplateStatus,
} from "../intregrations/whatsapp";
import { mapTemplateStatus } from "./templateStatus";

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
  whatsappTemplateName?: string | null;
  whatsappTemplateLanguage?: string | null;
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
 * Relee en Meta el estado de la plantilla ya creada y lo guarda si cambió.
 *
 * El webhook `message_template_status_update` no es fiable como única fuente: si la empresa no lo
 * configuró (es un paso manual) o el evento se perdió, la plantilla se queda en "pending" para
 * siempre aunque Meta ya la haya aprobado. Por eso se consulta al probar la conexión.
 *
 * `found: false` significa que esa plantilla ya no existe en la cuenta (la borraron, o se cambió
 * de WABA): el llamador la vuelve a crear.
 */
export async function syncOutreachTemplateStatus(
  company: TemplateOwner,
  context: KeystoneContext,
): Promise<{ found: boolean; error: string | null }> {
  if (!company.whatsappBusinessAccountId || !company.whatsappAccessTokenEncrypted) {
    // Sin cuenta o sin token no hay nada que consultar; los errores de configuración los reporta
    // la prueba de conexión, no esto.
    return { found: true, error: null };
  }

  const name = company.whatsappTemplateName || OUTREACH_TEMPLATE_NAME;

  try {
    const remote = await fetchWhatsAppTemplateStatus({
      wabaId: company.whatsappBusinessAccountId,
      accessToken: decrypt(company.whatsappAccessTokenEncrypted),
      name,
      language: company.whatsappTemplateLanguage || OUTREACH_TEMPLATE_LANGUAGE,
    });

    if (!remote) return { found: false, error: null };

    const status = mapTemplateStatus(remote.status);
    if (!status) return { found: true, error: null };

    const changed =
      status !== company.whatsappTemplateStatus ||
      name !== company.whatsappTemplateName ||
      (remote.language && remote.language !== company.whatsappTemplateLanguage);

    if (changed) {
      await context.sudo().query.SaasCompany.updateOne({
        where: { id: company.id },
        data: {
          whatsappTemplateName: name,
          whatsappTemplateLanguage: remote.language || company.whatsappTemplateLanguage || null,
          whatsappTemplateStatus: status,
        },
      });
    }

    return { found: true, error: null };
  } catch (err) {
    console.error(
      `[whatsapp] No se pudo consultar el estado de la plantilla de la empresa ${company.id}:`,
      err,
    );
    // No se toca lo guardado: un token caducado no significa que la plantilla se haya caído.
    return { found: true, error: cleanGraphMessage(err) };
  }
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
  // Ya se creó antes: no se recrea, pero sí se relee su estado en Meta (el webhook puede no
  // haber llegado nunca). Si resulta que ya no existe allá, se cae al camino de creación.
  if (company.whatsappTemplateStatus && company.whatsappTemplateStatus !== "none") {
    const synced = await syncOutreachTemplateStatus(company, context);
    if (synced.found || synced.error) return { error: synced.error };
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

    // Puede existir ya en Meta sin estar registrada de este lado (se creó antes de guardar el
    // estado, o se reconectó la cuenta). Adoptarla evita el "template already exists" de Meta,
    // que dejaría a la empresa sin plantilla utilizable aunque esté aprobada.
    const existing = await fetchWhatsAppTemplateStatus({
      wabaId: company.whatsappBusinessAccountId,
      accessToken,
      name: OUTREACH_TEMPLATE_NAME,
      language: OUTREACH_TEMPLATE_LANGUAGE,
    });

    if (existing) {
      await context.sudo().query.SaasCompany.updateOne({
        where: { id: company.id },
        data: {
          whatsappTemplateName: OUTREACH_TEMPLATE_NAME,
          whatsappTemplateLanguage: existing.language || OUTREACH_TEMPLATE_LANGUAGE,
          whatsappTemplateStatus: mapTemplateStatus(existing.status) ?? "pending",
        },
      });
      return { error: null };
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
        whatsappTemplateStatus: mapTemplateStatus(result.status) ?? "pending",
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
