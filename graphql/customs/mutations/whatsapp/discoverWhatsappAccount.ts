import { KeystoneContext } from "@keystone-6/core/types";
import { encrypt, maskApiKey } from "../../../../utils/helpers/encryption";
import {
  configureAppWebhook,
  debugWhatsAppToken,
  listWhatsAppPhoneNumbers,
  subscribeAppToWaba,
} from "../../../../utils/intregrations/whatsapp";
import { ensureOutreachTemplate } from "../../../../utils/whatsapp/ensureOutreachTemplate";
import { friendlyWhatsappError } from "../../../../utils/whatsapp/friendlyError";
import { getWebhookConfig } from "../../../../utils/whatsapp/webhookConfig";
import { canManageCompanyWhatsapp, denyCompanyWhatsappAccessMessage } from "./access";

const REQUIRED_SCOPES = ["whatsapp_business_messaging", "whatsapp_business_management"];
// Un token que expira pronto (los de prueba del panel duran ~24h) se rompería solo poco después.
const MIN_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

const typeDefs = `
  input DiscoverWhatsappAccountInput {
    companyId: ID!
    appId: String!
    appSecret: String!
    accessToken: String!
    """Si el token da acceso a varios números, cuál conectar. Vacío = se elige solo si hay uno."""
    phoneNumberId: String
  }

  type WhatsappPhoneOption {
    id: ID!
    displayPhoneNumber: String!
    verifiedName: String!
    wabaId: String!
  }

  type DiscoverWhatsappAccountResult {
    success: Boolean!
    message: String!
    """Texto original de Meta (soporte); vacío si el error es nuestro."""
    detail: String
    """true = el token da acceso a varios números: mostrar phoneOptions y reintentar con phoneNumberId."""
    needsSelection: Boolean!
    phoneOptions: [WhatsappPhoneOption!]!
    displayPhoneNumber: String
    verifiedName: String
    webhookConfigured: Boolean!
    webhookError: String
    templateError: String
  }

  type Mutation {
    discoverWhatsappAccount(input: DiscoverWhatsappAccountInput!): DiscoverWhatsappAccountResult!
  }
`;

const definition = `
  discoverWhatsappAccount(input: DiscoverWhatsappAccountInput!): DiscoverWhatsappAccountResult!
`;

type PhoneOption = {
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
  wabaId: string;
};

type Input = {
  companyId: string;
  appId: string;
  appSecret: string;
  accessToken: string;
  phoneNumberId?: string | null;
};

function fail(message: string, detail: string | null = null) {
  return {
    success: false,
    message,
    detail,
    needsSelection: false,
    phoneOptions: [] as PhoneOption[],
    displayPhoneNumber: null,
    verifiedName: null,
    webhookConfigured: false,
    webhookError: null,
    templateError: null,
  };
}

const resolver = {
  /**
   * Descubre en vez de pedir: con App ID + App Secret + token averigua el WABA y el número
   * (`debug_token` + `/phone_numbers`), valida permisos, guarda todo cifrado, configura el
   * webhook de la App por API y crea la plantilla de inicio. NO publica la App: en modo
   * desarrollo Meta no entrega mensajes reales (eso lo hace el usuario en el panel de Meta).
   */
  discoverWhatsappAccount: async (
    _root: unknown,
    { input }: { input: Input },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    if (!canManageCompanyWhatsapp(session, input.companyId)) {
      return fail(denyCompanyWhatsappAccessMessage(session));
    }

    const appId = input.appId.trim();
    const appSecret = input.appSecret.trim();
    const accessToken = input.accessToken.trim();
    if (!appId || !appSecret || !accessToken) {
      return fail("Faltan datos: pega el App ID, el App Secret y el token.");
    }

    const existing = await context.sudo().query.SaasCompany.findOne({
      where: { id: input.companyId },
      query: "id whatsappBusinessAccountId whatsappPhoneNumberId",
    });
    if (!existing) return fail("No se encontró la empresa");

    // 1) ¿El token es válido, de esta App y con los dos permisos?
    let wabaIds: string[];
    try {
      const info = await debugWhatsAppToken({ appId, appSecret, accessToken });

      if (!info.isValid) {
        return fail(
          "El token no es válido (expiró o fue revocado). Genera uno permanente en Configuración de la empresa → Usuarios del sistema.",
          info.invalidReason,
        );
      }
      if (info.appId && info.appId !== appId) {
        return fail(
          `Ese token es de otra App de Meta (ID ${info.appId}), no de la App con ID ${appId}. Genera el token desde la misma App.`,
        );
      }
      if (info.expiresAt !== 0 && info.expiresAt * 1000 - Date.now() < MIN_TOKEN_LIFETIME_MS) {
        return fail(
          "Ese token es temporal y va a dejar de funcionar pronto. Genera uno permanente (sin fecha de expiración) con un usuario del sistema.",
        );
      }
      const missing = REQUIRED_SCOPES.filter((s) => !info.scopes.includes(s));
      if (missing.length > 0) {
        return fail(
          `Al token le falta el permiso: ${missing.join(" y ")}. Genera uno nuevo con los dos permisos (whatsapp_business_messaging y whatsapp_business_management).`,
        );
      }
      if (info.wabaIds.length === 0) {
        return fail(
          "El token no da acceso a ninguna cuenta de WhatsApp Business. Al generarlo, asigna la cuenta de WhatsApp Business al usuario del sistema.",
        );
      }
      wabaIds = info.wabaIds;
    } catch (err) {
      const f = friendlyWhatsappError(err);
      return fail(f.message, f.detail);
    }

    // 2) Números disponibles en esas cuentas.
    const options: PhoneOption[] = [];
    let firstListError: unknown = null;
    for (const wabaId of wabaIds) {
      try {
        const numbers = await listWhatsAppPhoneNumbers({ wabaId, accessToken });
        for (const n of numbers) options.push({ ...n, wabaId });
      } catch (err) {
        firstListError ??= err;
      }
    }
    if (options.length === 0) {
      if (firstListError) {
        const f = friendlyWhatsappError(firstListError);
        return fail(f.message, f.detail);
      }
      return fail(
        "Encontramos tu cuenta de WhatsApp Business pero no tiene ningún número. Agrega uno en WhatsApp → Configuración de la API y vuelve a intentar.",
      );
    }

    const wantedId = input.phoneNumberId?.trim() || null;
    let chosen: PhoneOption | undefined;
    if (wantedId) {
      chosen = options.find((o) => o.id === wantedId);
      if (!chosen) return fail("Ese número no está entre los que da acceso el token.");
    } else if (options.length === 1) {
      chosen = options[0];
    } else {
      return {
        ...fail("Este token da acceso a varios números. Elige cuál conectar."),
        success: true,
        needsSelection: true,
        phoneOptions: options,
      };
    }

    // 3) Que ese número / cuenta no estén ya en otra empresa (ambos son únicos).
    const clash = await context.sudo().query.SaasCompany.findMany({
      where: {
        id: { not: { equals: input.companyId } },
        OR: [
          { whatsappPhoneNumberId: { equals: chosen.id } },
          { whatsappBusinessAccountId: { equals: chosen.wabaId } },
        ],
      },
      query: "id",
      take: 1,
    });
    if (clash.length > 0) {
      return fail("Ese número o esa cuenta de WhatsApp Business ya está conectado a otra empresa.");
    }

    // 4) Guardar cifrado. Si cambió de cuenta/número se reinicia lo que dependía de la anterior.
    const changedAccount =
      existing.whatsappBusinessAccountId !== chosen.wabaId ||
      existing.whatsappPhoneNumberId !== chosen.id;
    try {
      await context.sudo().query.SaasCompany.updateOne({
        where: { id: input.companyId },
        data: {
          whatsappAppId: appId,
          whatsappPhoneNumberId: chosen.id,
          whatsappBusinessAccountId: chosen.wabaId,
          whatsappDisplayPhoneNumber: chosen.displayPhoneNumber || null,
          whatsappAccessTokenEncrypted: encrypt(accessToken),
          whatsappAppSecretEncrypted: encrypt(appSecret),
          whatsappTokenPreview: maskApiKey(accessToken),
          whatsappConnectedAt: new Date().toISOString(),
          ...(changedAccount
            ? {
                whatsappTemplateName: null,
                whatsappTemplateStatus: "none",
                whatsappLastWebhookAt: null,
                whatsappWebhookConfiguredAt: null,
              }
            : {}),
        },
      });
    } catch (err) {
      const f = friendlyWhatsappError(err);
      return fail(f.message, f.detail);
    }

    // 5) Webhook por API (best-effort: si falla, el front cae al modo manual).
    let webhookConfigured = false;
    let webhookError: string | null = null;
    const webhook = getWebhookConfig();
    if (!webhook) {
      webhookError =
        "Falta configurar WHATSAPP_WEBHOOK_VERIFY_TOKEN o WHATSAPP_WEBHOOK_BASE_URL en el servidor de Kadesh.";
    } else {
      try {
        await subscribeAppToWaba({ wabaId: chosen.wabaId, accessToken });
        await configureAppWebhook({
          appId,
          appSecret,
          callbackUrl: webhook.webhookUrl,
          verifyToken: webhook.verifyToken,
        });
        webhookConfigured = true;
        await context.sudo().query.SaasCompany.updateOne({
          where: { id: input.companyId },
          data: { whatsappWebhookConfiguredAt: new Date().toISOString() },
        });
      } catch (err) {
        const f = friendlyWhatsappError(err);
        webhookError = f.detail === f.message ? f.message : `${f.message} (${f.detail})`;
      }
    }

    // 6) Plantilla de inicio (best-effort, con su motivo si falla).
    const company = await context.sudo().query.SaasCompany.findOne({
      where: { id: input.companyId },
      query:
        "id whatsappPhoneNumberId whatsappBusinessAccountId whatsappAccessTokenEncrypted whatsappTemplateStatus",
    });
    const template = await ensureOutreachTemplate(company as any, context);

    return {
      success: true,
      message: "WhatsApp conectado",
      detail: null,
      needsSelection: false,
      phoneOptions: [] as PhoneOption[],
      displayPhoneNumber: chosen.displayPhoneNumber,
      verifiedName: chosen.verifiedName,
      webhookConfigured,
      webhookError,
      templateError: template.error,
    };
  },
};

export default { typeDefs, definition, resolver };
