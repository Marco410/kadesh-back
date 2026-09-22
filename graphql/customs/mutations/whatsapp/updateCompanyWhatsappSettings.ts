import { KeystoneContext } from "@keystone-6/core/types";
import { encrypt, maskApiKey } from "../../../../utils/helpers/encryption";
import { canManageCompanyWhatsapp, denyCompanyWhatsappAccessMessage } from "./access";

const typeDefs = `
  input UpdateCompanyWhatsappSettingsInput {
    companyId: ID!
    phoneNumberId: String
    businessAccountId: String
    accessToken: String
    appSecret: String
  }

  type UpdateCompanyWhatsappSettingsResult {
    success: Boolean!
    message: String!
    phoneNumberId: String
    businessAccountId: String
    displayPhoneNumber: String
    tokenPreview: String
    appSecretConfigured: Boolean!
    connectedAt: String
  }

  type Mutation {
    updateCompanyWhatsappSettings(input: UpdateCompanyWhatsappSettingsInput!): UpdateCompanyWhatsappSettingsResult!
  }
`;

const definition = `
  updateCompanyWhatsappSettings(input: UpdateCompanyWhatsappSettingsInput!): UpdateCompanyWhatsappSettingsResult!
`;

type UpdateCompanyWhatsappSettingsInput = {
  companyId: string;
  phoneNumberId?: string | null;
  businessAccountId?: string | null;
  accessToken?: string | null;
  appSecret?: string | null;
};

type CompanyWhatsappSettingsRecord = {
  id: string;
  whatsappPhoneNumberId?: string | null;
  whatsappBusinessAccountId?: string | null;
  whatsappDisplayPhoneNumber?: string | null;
  whatsappTokenPreview?: string | null;
  whatsappAppSecretEncrypted?: string | null;
  whatsappConnectedAt?: string | null;
};

const SETTINGS_QUERY =
  "id whatsappPhoneNumberId whatsappBusinessAccountId whatsappDisplayPhoneNumber whatsappTokenPreview whatsappAppSecretEncrypted whatsappConnectedAt";

function toResult(
  success: boolean,
  message: string,
  company?: CompanyWhatsappSettingsRecord | null,
) {
  return {
    success,
    message,
    phoneNumberId: company?.whatsappPhoneNumberId ?? null,
    businessAccountId: company?.whatsappBusinessAccountId ?? null,
    displayPhoneNumber: company?.whatsappDisplayPhoneNumber ?? null,
    tokenPreview: company?.whatsappTokenPreview ?? null,
    appSecretConfigured: Boolean(company?.whatsappAppSecretEncrypted),
    connectedAt: company?.whatsappConnectedAt ?? null,
  };
}

const resolver = {
  updateCompanyWhatsappSettings: async (
    _root: unknown,
    { input }: { input: UpdateCompanyWhatsappSettingsInput },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    if (!canManageCompanyWhatsapp(session, input.companyId)) {
      return toResult(false, denyCompanyWhatsappAccessMessage(session));
    }

    const existing = (await context.sudo().query.SaasCompany.findOne({
      where: { id: input.companyId },
      query: SETTINGS_QUERY,
    })) as CompanyWhatsappSettingsRecord | null;

    if (!existing) {
      return toResult(false, "No se encontró la empresa");
    }

    const data: Record<string, unknown> = {};

    if (input.phoneNumberId !== undefined) {
      const phoneNumberId = input.phoneNumberId?.trim() || null;
      if (phoneNumberId) {
        const clash = await context.sudo().query.SaasCompany.findMany({
          where: {
            whatsappPhoneNumberId: { equals: phoneNumberId },
            id: { not: { equals: input.companyId } },
          },
          query: "id",
          take: 1,
        });
        if (clash.length > 0) {
          return toResult(
            false,
            "Ese Phone Number ID ya está conectado a otra cuenta",
            existing,
          );
        }
      }
      data.whatsappPhoneNumberId = phoneNumberId;
    }

    if (input.businessAccountId !== undefined) {
      data.whatsappBusinessAccountId = input.businessAccountId?.trim() || null;
    }

    if (input.accessToken !== undefined && input.accessToken !== null) {
      if (input.accessToken === "") {
        data.whatsappAccessTokenEncrypted = null;
        data.whatsappTokenPreview = null;
        data.whatsappDisplayPhoneNumber = null;
        data.whatsappConnectedAt = null;
      } else {
        try {
          data.whatsappAccessTokenEncrypted = encrypt(input.accessToken.trim());
        } catch (err) {
          return toResult(
            false,
            err instanceof Error
              ? err.message
              : "No se pudo cifrar el access token. Revisa AI_ENCRYPTION_KEY.",
            existing,
          );
        }
        data.whatsappTokenPreview = maskApiKey(input.accessToken);
        data.whatsappConnectedAt = new Date().toISOString();
      }
    }

    if (input.appSecret !== undefined && input.appSecret !== null) {
      if (input.appSecret === "") {
        data.whatsappAppSecretEncrypted = null;
      } else {
        try {
          data.whatsappAppSecretEncrypted = encrypt(input.appSecret.trim());
        } catch (err) {
          return toResult(
            false,
            err instanceof Error
              ? err.message
              : "No se pudo cifrar el App Secret. Revisa AI_ENCRYPTION_KEY.",
            existing,
          );
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return toResult(true, "No hay cambios que guardar", existing);
    }

    const updated = (await context.sudo().query.SaasCompany.updateOne({
      where: { id: input.companyId },
      data,
      query: SETTINGS_QUERY,
    })) as CompanyWhatsappSettingsRecord;

    return toResult(true, "Configuración de WhatsApp guardada", updated);
  },
};

export default { typeDefs, definition, resolver };
