import { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId } from "../../../../utils/access/tenant";
import { decrypt, encrypt } from "../../../../utils/helpers/encryption";
import { listCalendarList } from "../../../../utils/googleCalendar/client";
import { syncCalendarList } from "../../../../utils/googleCalendar/calendars";
import { persistGoogleCalendarSyncLog } from "../../../../utils/googleCalendar/callLog";
import { GoogleCalendarScopeType } from "../../../../utils/googleCalendar/constants";
import { friendlyGoogleCalendarError } from "../../../../utils/googleCalendar/errors";
import { exchangeCodeForTokens } from "../../../../utils/googleCalendar/oauth";
import {
  CALENDAR_FEATURE_DENIED_MESSAGE,
  companyHasCalendarFeature,
} from "../../../../utils/googleCalendar/planFeature";
import { verifyGoogleCalendarState } from "../../../../utils/googleCalendar/state";
import { canConnectGoogleCalendar, denyGoogleCalendarAccessMessage } from "./access";

const typeDefs = `
  type ConnectGoogleCalendarResult {
    success: Boolean!
    message: String!
    accountId: ID
    googleAccountEmail: String
    calendarsCount: Int
  }

  type Mutation {
    connectGoogleCalendarAccount(code: String!, state: String!): ConnectGoogleCalendarResult!
  }
`;

const definition = `
  connectGoogleCalendarAccount(code: String!, state: String!): ConnectGoogleCalendarResult!
`;

const fail = (message: string) => ({
  success: false,
  message,
  accountId: null,
  googleAccountEmail: null,
  calendarsCount: null,
});

const resolver = {
  connectGoogleCalendarAccount: async (
    _root: unknown,
    { code, state }: { code: string; state: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    const userId = getSessionUserId(session);
    if (!userId) return fail(denyGoogleCalendarAccessMessage(session));

    // El state debe haberlo emitido getGoogleCalendarAuthUrl para ESTE mismo usuario.
    const payload = verifyGoogleCalendarState(state);
    if (!payload || payload.uid !== userId) {
      return fail("La solicitud de conexión no es válida o expiró. Inténtalo de nuevo.");
    }
    const { cid: companyId, st: scopeType } = payload;

    if (!canConnectGoogleCalendar(session, scopeType, companyId)) {
      return fail(denyGoogleCalendarAccessMessage(session));
    }
    if (!(await companyHasCalendarFeature(context, companyId))) {
      return fail(CALENDAR_FEATURE_DENIED_MESSAGE);
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      const calendars = await listCalendarList(tokens.accessToken);
      // El calendario principal de una cuenta de Google tiene como id su correo.
      const email = calendars.find((c) => c.primary)?.id;
      if (!email) return fail("No se pudo identificar la cuenta de Google conectada");

      const sudo = context.sudo();
      const ownerWhere =
        scopeType === GoogleCalendarScopeType.PERSONAL
          ? { user: { id: { equals: userId } } }
          : { company: { id: { equals: companyId } } };
      const [existing] = (await sudo.query.GoogleCalendarAccount.findMany({
        where: {
          scopeType: { equals: scopeType },
          googleAccountEmail: { equals: email },
          ...ownerWhere,
        },
        take: 1,
        query: "id refreshTokenEncrypted",
      })) as { id: string; refreshTokenEncrypted?: string | null }[];

      // Google solo entrega refresh_token en el primer consentimiento; si no vino,
      // se conserva el que ya teníamos.
      const refreshToken =
        tokens.refreshToken ??
        (existing?.refreshTokenEncrypted ? decrypt(existing.refreshTokenEncrypted) : null);
      if (!refreshToken) {
        return fail(
          "Google no entregó acceso permanente. Revoca el acceso de Kadesh en tu cuenta de Google y vuelve a conectar.",
        );
      }

      const tokenData = {
        googleAccountEmail: email,
        accessTokenEncrypted: encrypt(tokens.accessToken),
        refreshTokenEncrypted: encrypt(refreshToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString(),
        scope: tokens.scope,
        isActive: true,
        lastSyncError: null,
        connectedByUser: { connect: { id: userId } },
      };

      const account = existing
        ? await sudo.query.GoogleCalendarAccount.updateOne({
            where: { id: existing.id },
            data: tokenData,
            query: "id googleAccountEmail",
          })
        : await sudo.query.GoogleCalendarAccount.createOne({
            data: {
              ...tokenData,
              scopeType,
              ...(scopeType === GoogleCalendarScopeType.PERSONAL
                ? { user: { connect: { id: userId } } }
                : { company: { connect: { id: companyId } } }),
            },
            query: "id googleAccountEmail",
          });

      const calendarsCount = await syncCalendarList(context, account.id, calendars);
      await persistGoogleCalendarSyncLog({
        context,
        accountId: account.id,
        direction: "pull",
        operation: "list_calendars",
        success: true,
      });

      return {
        success: true,
        message: "Cuenta de Google conectada",
        accountId: account.id,
        googleAccountEmail: account.googleAccountEmail,
        calendarsCount,
      };
    } catch (err) {
      console.error("connectGoogleCalendarAccount:", err);
      return fail(friendlyGoogleCalendarError(err));
    }
  },
};

export default { typeDefs, definition, resolver };
