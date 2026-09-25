import { KeystoneContext } from "@keystone-6/core/types";
import { friendlyGoogleCalendarError } from "../../../../utils/googleCalendar/errors";
import {
  CALENDAR_FEATURE_DENIED_MESSAGE,
  companyHasCalendarFeature,
} from "../../../../utils/googleCalendar/planFeature";
import {
  PULL_SELECTION_QUERY,
  pullEventsForSelection,
  type PulledGoogleEvent,
} from "../../../../utils/googleCalendar/sync";
import {
  ACCOUNT_SCOPE_QUERY,
  accountCompanyId,
  canViewGoogleCalendarAccount,
  denyGoogleCalendarAccessMessage,
  type GoogleAccountScope,
} from "../../mutations/googleCalendar/access";

const MAX_SELECTIONS = 25;

const typeDefs = `
  type GoogleCalendarPulledEvent {
    id: String!
    selectionId: ID!
    calendarId: String!
    calendarName: String!
    accountEmail: String!
    colorHex: String
    title: String!
    description: String
    location: String
    start: String!
    end: String
    allDay: Boolean!
    htmlLink: String
    kadeshEventId: ID
  }

  type SyncGoogleCalendarNowResult {
    success: Boolean!
    message: String
    events: [GoogleCalendarPulledEvent!]!
  }

  type Query {
    syncGoogleCalendarNow(selectionIds: [ID!]!, timeMin: String!, timeMax: String!): SyncGoogleCalendarNowResult!
  }
`;

const definition = `
  syncGoogleCalendarNow(selectionIds: [ID!]!, timeMin: String!, timeMax: String!): SyncGoogleCalendarNowResult!
`;

const resolver = {
  syncGoogleCalendarNow: async (
    _root: unknown,
    {
      selectionIds,
      timeMin,
      timeMax,
    }: { selectionIds: string[]; timeMin: string; timeMax: string },
    context: KeystoneContext,
  ) => {
    const fail = (message: string) => ({ success: false, message, events: [] });

    if (!context.session?.data?.id) return fail(denyGoogleCalendarAccessMessage(context.session));
    if (selectionIds.length === 0) return { success: true, message: null, events: [] };
    if (selectionIds.length > MAX_SELECTIONS) {
      return fail(`Máximo ${MAX_SELECTIONS} calendarios por consulta`);
    }
    const min = new Date(timeMin);
    const max = new Date(timeMax);
    if (Number.isNaN(min.getTime()) || Number.isNaN(max.getTime()) || max <= min) {
      return fail("Rango de fechas inválido");
    }

    const selections = (await context.sudo().query.GoogleCalendarSelection.findMany({
      where: { id: { in: selectionIds } },
      query: `${PULL_SELECTION_QUERY} account { ${ACCOUNT_SCOPE_QUERY} }`,
    })) as any[];

    const events: PulledGoogleEvent[] = [];
    const errors: string[] = [];
    const featureByCompany = new Map<string, boolean>();

    for (const selection of selections) {
      const scope = selection.account as GoogleAccountScope;
      if (!canViewGoogleCalendarAccount(context.session, scope)) continue;

      const companyId = accountCompanyId(scope);
      if (companyId) {
        if (!featureByCompany.has(companyId)) {
          featureByCompany.set(companyId, await companyHasCalendarFeature(context, companyId));
        }
        if (!featureByCompany.get(companyId)) return fail(CALENDAR_FEATURE_DENIED_MESSAGE);
      }

      try {
        events.push(
          ...(await pullEventsForSelection(context, selection, min.toISOString(), max.toISOString())),
        );
      } catch (err) {
        errors.push(
          `${selection.calendarName ?? selection.googleCalendarId}: ${friendlyGoogleCalendarError(err)}`,
        );
      }
    }

    events.sort((a, b) => a.start.localeCompare(b.start));
    return {
      success: errors.length === 0,
      message: errors.length ? errors.join(" | ") : null,
      events,
    };
  },
};

export default { typeDefs, definition, resolver };
