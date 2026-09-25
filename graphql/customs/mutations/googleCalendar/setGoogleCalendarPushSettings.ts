import { KeystoneContext } from "@keystone-6/core/types";
import {
  ACCOUNT_SCOPE_QUERY,
  canManageGoogleCalendarAccount,
  accountCompanyId,
  denyGoogleCalendarAccessMessage,
  type GoogleAccountScope,
} from "./access";
import {
  CALENDAR_FEATURE_DENIED_MESSAGE,
  companyHasCalendarFeature,
} from "../../../../utils/googleCalendar/planFeature";

const typeDefs = `
  input GoogleCalendarPushSettingsInput {
    pushActivities: Boolean
    pushProposals: Boolean
    pushFollowUps: Boolean
    pushTasks: Boolean
  }

  type SetGoogleCalendarPushSettingsResult {
    success: Boolean!
    message: String!
    selectionId: ID
    pushActivities: Boolean
    pushProposals: Boolean
    pushFollowUps: Boolean
    pushTasks: Boolean
  }

  type Mutation {
    setGoogleCalendarPushSettings(selectionId: ID!, settings: GoogleCalendarPushSettingsInput!): SetGoogleCalendarPushSettingsResult!
  }
`;

const definition = `
  setGoogleCalendarPushSettings(selectionId: ID!, settings: GoogleCalendarPushSettingsInput!): SetGoogleCalendarPushSettingsResult!
`;

type Settings = {
  pushActivities?: boolean | null;
  pushProposals?: boolean | null;
  pushFollowUps?: boolean | null;
  pushTasks?: boolean | null;
};

const FLAGS = ["pushActivities", "pushProposals", "pushFollowUps", "pushTasks"] as const;

const fail = (message: string) => ({
  success: false,
  message,
  selectionId: null,
  pushActivities: null,
  pushProposals: null,
  pushFollowUps: null,
  pushTasks: null,
});

const resolver = {
  setGoogleCalendarPushSettings: async (
    _root: unknown,
    { selectionId, settings }: { selectionId: string; settings: Settings },
    context: KeystoneContext,
  ) => {
    const selection = (await context.sudo().query.GoogleCalendarSelection.findOne({
      where: { id: selectionId },
      query: `id account { ${ACCOUNT_SCOPE_QUERY} }`,
    })) as { id: string; account?: GoogleAccountScope | null } | null;

    if (!selection?.account) return fail("Calendario no encontrado");
    if (!canManageGoogleCalendarAccount(context.session, selection.account)) {
      return fail(denyGoogleCalendarAccessMessage(context.session));
    }
    const companyId = accountCompanyId(selection.account);
    if (companyId && !(await companyHasCalendarFeature(context, companyId))) {
      return fail(CALENDAR_FEATURE_DENIED_MESSAGE);
    }

    // Solo se actualizan las banderas que vienen (null/undefined = no tocar).
    const data: Record<string, boolean> = {};
    for (const flag of FLAGS) {
      const value = settings[flag];
      if (typeof value === "boolean") data[flag] = value;
    }

    const updated = await context.sudo().query.GoogleCalendarSelection.updateOne({
      where: { id: selectionId },
      data,
      query: "id pushActivities pushProposals pushFollowUps pushTasks",
    });
    return {
      success: true,
      message: "Preferencias guardadas",
      selectionId: updated.id,
      pushActivities: updated.pushActivities,
      pushProposals: updated.pushProposals,
      pushFollowUps: updated.pushFollowUps,
      pushTasks: updated.pushTasks,
    };
  },
};

export default { typeDefs, definition, resolver };
