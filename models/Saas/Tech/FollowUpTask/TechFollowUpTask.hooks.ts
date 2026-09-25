import { validateTechStatusCrmInput } from "../../../../utils/validation/validateTechStatusCrm";
import { crmCalendarHooks } from "../../../../utils/googleCalendar/crmEvents";

export const followUpTaskHooks = {
  ...crmCalendarHooks,
  validateInput: async ({
    context,
    resolvedData,
    item,
    addValidationError,
  }: any) => {
    await validateTechStatusCrmInput({
      context,
      resolvedData,
      item,
      listKey: "TechFollowUpTask",
      addValidationError,
    });
  },
};
