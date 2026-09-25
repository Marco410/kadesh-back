import { KeystoneContext } from "@keystone-6/core/types";
import {
  getSessionCompanyId,
  getSessionUserId,
  isPlatformAdmin,
} from "../../../../utils/access/tenant";
import { GoogleCalendarScopeType } from "../../../../utils/googleCalendar/constants";
import { friendlyGoogleCalendarError } from "../../../../utils/googleCalendar/errors";
import { buildGoogleAuthUrl } from "../../../../utils/googleCalendar/oauth";
import {
  CALENDAR_FEATURE_DENIED_MESSAGE,
  companyHasCalendarFeature,
} from "../../../../utils/googleCalendar/planFeature";
import { signGoogleCalendarState } from "../../../../utils/googleCalendar/state";
import { canConnectGoogleCalendar, denyGoogleCalendarAccessMessage } from "./access";

const typeDefs = `
  type GoogleCalendarAuthUrlResult {
    success: Boolean!
    message: String
    url: String
  }

  type Mutation {
    getGoogleCalendarAuthUrl(scopeType: String!, companyId: ID): GoogleCalendarAuthUrlResult!
  }
`;

const definition = `
  getGoogleCalendarAuthUrl(scopeType: String!, companyId: ID): GoogleCalendarAuthUrlResult!
`;

const fail = (message: string) => ({ success: false, message, url: null });

const resolver = {
  getGoogleCalendarAuthUrl: async (
    _root: unknown,
    { scopeType, companyId }: { scopeType: string; companyId?: string | null },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    const userId = getSessionUserId(session);
    if (!userId) return fail(denyGoogleCalendarAccessMessage(session));

    if (
      scopeType !== GoogleCalendarScopeType.PERSONAL &&
      scopeType !== GoogleCalendarScopeType.COMPANY
    ) {
      return fail("Tipo de cuenta inválido (personal o company)");
    }

    // Solo el admin de plataforma puede operar sobre una empresa distinta a la suya.
    const targetCompanyId =
      (isPlatformAdmin(session) && companyId) || getSessionCompanyId(session);
    if (!targetCompanyId) return fail("Tu usuario no tiene una empresa asignada");

    if (!canConnectGoogleCalendar(session, scopeType, targetCompanyId)) {
      return fail(
        scopeType === GoogleCalendarScopeType.COMPANY
          ? "Solo el administrador de la empresa puede conectar la cuenta compartida"
          : denyGoogleCalendarAccessMessage(session),
      );
    }

    if (!(await companyHasCalendarFeature(context, targetCompanyId))) {
      return fail(CALENDAR_FEATURE_DENIED_MESSAGE);
    }

    try {
      const state = signGoogleCalendarState({
        uid: userId,
        cid: targetCompanyId,
        st: scopeType,
      });
      return { success: true, message: null, url: buildGoogleAuthUrl(state) };
    } catch (err) {
      return fail(friendlyGoogleCalendarError(err));
    }
  },
};

export default { typeDefs, definition, resolver };
