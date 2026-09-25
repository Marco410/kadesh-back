import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../../../../utils/helpers/encryption";
import { deleteSelections } from "../../../../utils/googleCalendar/calendars";
import { revokeGoogleToken } from "../../../../utils/googleCalendar/oauth";
import {
  ACCOUNT_SCOPE_QUERY,
  canManageGoogleCalendarAccount,
  denyGoogleCalendarAccessMessage,
  type GoogleAccountScope,
} from "./access";

const typeDefs = `
  type GoogleCalendarActionResult {
    success: Boolean!
    message: String!
  }

  type Mutation {
    disconnectGoogleCalendarAccount(accountId: ID!): GoogleCalendarActionResult!
  }
`;

const definition = `
  disconnectGoogleCalendarAccount(accountId: ID!): GoogleCalendarActionResult!
`;

const resolver = {
  disconnectGoogleCalendarAccount: async (
    _root: unknown,
    { accountId }: { accountId: string },
    context: KeystoneContext,
  ) => {
    const sudo = context.sudo();
    const account = (await sudo.query.GoogleCalendarAccount.findOne({
      where: { id: accountId },
      query: `id refreshTokenEncrypted ${ACCOUNT_SCOPE_QUERY}`,
    })) as (GoogleAccountScope & { id: string; refreshTokenEncrypted?: string | null }) | null;

    if (!account) return { success: false, message: "Cuenta no encontrada" };
    if (!canManageGoogleCalendarAccount(context.session, account)) {
      return { success: false, message: denyGoogleCalendarAccessMessage(context.session) };
    }

    try {
      if (account.refreshTokenEncrypted) {
        await revokeGoogleToken(decrypt(account.refreshTokenEncrypted));
      }
      const selections = (await sudo.query.GoogleCalendarSelection.findMany({
        where: { account: { id: { equals: accountId } } },
        query: "id",
      })) as { id: string }[];
      await deleteSelections(context, selections.map((s) => s.id));
      await sudo.query.GoogleCalendarAccount.deleteOne({ where: { id: accountId } });
      return { success: true, message: "Cuenta de Google desconectada" };
    } catch (err) {
      console.error("disconnectGoogleCalendarAccount:", err);
      return { success: false, message: "No se pudo desconectar la cuenta" };
    }
  },
};

export default { typeDefs, definition, resolver };
