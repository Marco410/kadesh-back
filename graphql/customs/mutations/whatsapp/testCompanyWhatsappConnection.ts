import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../../../../utils/helpers/encryption";
import { fetchWhatsAppPhoneNumberInfo } from "../../../../utils/intregrations/whatsapp";
import { ensureOutreachTemplate } from "../../../../utils/whatsapp/ensureOutreachTemplate";
import { canManageCompanyWhatsapp, denyCompanyWhatsappAccessMessage } from "./access";

const typeDefs = `
  type TestCompanyWhatsappConnectionResult {
    success: Boolean!
    message: String!
    displayPhoneNumber: String
    verifiedName: String
  }

  type Mutation {
    testCompanyWhatsappConnection(companyId: ID!): TestCompanyWhatsappConnectionResult!
  }
`;

const definition = `
  testCompanyWhatsappConnection(companyId: ID!): TestCompanyWhatsappConnectionResult!
`;

const resolver = {
  testCompanyWhatsappConnection: async (
    _root: unknown,
    { companyId }: { companyId: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    if (!canManageCompanyWhatsapp(session, companyId)) {
      return { success: false, message: denyCompanyWhatsappAccessMessage(session) };
    }

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { id: companyId },
      query:
        "id whatsappPhoneNumberId whatsappAccessTokenEncrypted whatsappBusinessAccountId whatsappTemplateStatus",
    });

    if (!company?.whatsappPhoneNumberId || !company?.whatsappAccessTokenEncrypted) {
      return {
        success: false,
        message: "Falta configurar el Phone Number ID o el access token",
      };
    }

    try {
      const accessToken = decrypt(company.whatsappAccessTokenEncrypted);
      const info = await fetchWhatsAppPhoneNumberInfo({
        phoneNumberId: company.whatsappPhoneNumberId,
        accessToken,
      });

      await context.sudo().query.SaasCompany.updateOne({
        where: { id: companyId },
        data: {
          whatsappDisplayPhoneNumber: info.displayPhoneNumber || null,
          whatsappConnectedAt: new Date().toISOString(),
        },
      });

      // Best-effort: no bloquea la respuesta de "probar conexión" si falla.
      await ensureOutreachTemplate(company as any, context);

      return {
        success: true,
        message: "Conexión OK con WhatsApp Business",
        displayPhoneNumber: info.displayPhoneNumber,
        verifiedName: info.verifiedName,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Error al probar la conexión",
      };
    }
  },
};

export default { typeDefs, definition, resolver };
