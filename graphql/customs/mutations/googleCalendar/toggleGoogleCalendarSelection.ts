import { KeystoneContext } from "@keystone-6/core/types";
import {
  CALENDAR_FEATURE_DENIED_MESSAGE,
  companyHasCalendarFeature,
} from "../../../../utils/googleCalendar/planFeature";
import {
  ACCOUNT_SCOPE_QUERY,
  accountCompanyId,
  canManageGoogleCalendarAccount,
  denyGoogleCalendarAccessMessage,
  type GoogleAccountScope,
} from "./access";

const typeDefs = `
  type ToggleGoogleCalendarSelectionResult {
    success: Boolean!
    message: String!
    selectionId: ID
    isSelected: Boolean
  }

  type Mutation {
    toggleGoogleCalendarSelection(selectionId: ID!, isSelected: Boolean!): ToggleGoogleCalendarSelectionResult!
  }
`;

const definition = `
  toggleGoogleCalendarSelection(selectionId: ID!, isSelected: Boolean!): ToggleGoogleCalendarSelectionResult!
`;

const resolver = {
  toggleGoogleCalendarSelection: async (
    _root: unknown,
    { selectionId, isSelected }: { selectionId: string; isSelected: boolean },
    context: KeystoneContext,
  ) => {
    const selection = (await context.sudo().query.GoogleCalendarSelection.findOne({
      where: { id: selectionId },
      query: `id account { ${ACCOUNT_SCOPE_QUERY} }`,
    })) as { id: string; account?: GoogleAccountScope | null } | null;

    if (!selection?.account) {
      return { success: false, message: "Calendario no encontrado", selectionId: null, isSelected: null };
    }
    if (!canManageGoogleCalendarAccount(context.session, selection.account)) {
      return {
        success: false,
        message: denyGoogleCalendarAccessMessage(context.session),
        selectionId: null,
        isSelected: null,
      };
    }
    const companyId = accountCompanyId(selection.account);
    if (companyId && !(await companyHasCalendarFeature(context, companyId))) {
      return { success: false, message: CALENDAR_FEATURE_DENIED_MESSAGE, selectionId: null, isSelected: null };
    }

    const updated = await context.sudo().query.GoogleCalendarSelection.updateOne({
      where: { id: selectionId },
      data: { isSelected },
      query: "id isSelected",
    });
    return {
      success: true,
      message: isSelected ? "Calendario seleccionado" : "Calendario deseleccionado",
      selectionId: updated.id,
      isSelected: updated.isSelected,
    };
  },
};

export default { typeDefs, definition, resolver };
