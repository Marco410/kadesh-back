import { KeystoneContext } from "@keystone-6/core/types";
import { listCalendarList } from "../../../../utils/googleCalendar/client";
import { syncCalendarList } from "../../../../utils/googleCalendar/calendars";
import { persistGoogleCalendarSyncLog } from "../../../../utils/googleCalendar/callLog";
import { friendlyGoogleCalendarError } from "../../../../utils/googleCalendar/errors";
import {
  CALENDAR_FEATURE_DENIED_MESSAGE,
  companyHasCalendarFeature,
} from "../../../../utils/googleCalendar/planFeature";
import {
  ACCOUNT_TOKEN_QUERY,
  getValidAccessToken,
} from "../../../../utils/googleCalendar/tokenManager";
import {
  ACCOUNT_SCOPE_QUERY,
  accountCompanyId,
  canManageGoogleCalendarAccount,
  denyGoogleCalendarAccessMessage,
  type GoogleAccountScope,
} from "./access";

const typeDefs = `
  type RefreshGoogleCalendarListResult {
    success: Boolean!
    message: String!
    calendarsCount: Int
  }

  type Mutation {
    refreshGoogleCalendarList(accountId: ID!): RefreshGoogleCalendarListResult!
  }
`;

const definition = `
  refreshGoogleCalendarList(accountId: ID!): RefreshGoogleCalendarListResult!
`;

const resolver = {
  refreshGoogleCalendarList: async (
    _root: unknown,
    { accountId }: { accountId: string },
    context: KeystoneContext,
  ) => {
    const account = (await context.sudo().query.GoogleCalendarAccount.findOne({
      where: { id: accountId },
      query: `${ACCOUNT_TOKEN_QUERY} ${ACCOUNT_SCOPE_QUERY}`,
    })) as (GoogleAccountScope & Record<string, any>) | null;

    if (!account) return { success: false, message: "Cuenta no encontrada", calendarsCount: null };
    if (!canManageGoogleCalendarAccount(context.session, account)) {
      return {
        success: false,
        message: denyGoogleCalendarAccessMessage(context.session),
        calendarsCount: null,
      };
    }
    const companyId = accountCompanyId(account);
    if (companyId && !(await companyHasCalendarFeature(context, companyId))) {
      return { success: false, message: CALENDAR_FEATURE_DENIED_MESSAGE, calendarsCount: null };
    }

    const startedAt = Date.now();
    try {
      const accessToken = await getValidAccessToken(context, account as any);
      const calendars = await listCalendarList(accessToken);
      const calendarsCount = await syncCalendarList(context, accountId, calendars);
      await persistGoogleCalendarSyncLog({
        context,
        accountId,
        direction: "pull",
        operation: "list_calendars",
        success: true,
        durationMs: Date.now() - startedAt,
      });
      return { success: true, message: "Calendarios actualizados", calendarsCount };
    } catch (err) {
      await persistGoogleCalendarSyncLog({
        context,
        accountId,
        direction: "pull",
        operation: "list_calendars",
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
      });
      return { success: false, message: friendlyGoogleCalendarError(err), calendarsCount: null };
    }
  },
};

export default { typeDefs, definition, resolver };
