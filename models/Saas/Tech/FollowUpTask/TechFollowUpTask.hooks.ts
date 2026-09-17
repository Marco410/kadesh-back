import { validateTechStatusCrmInput } from "../../../utils/validation/validateTechStatusCrm";

export const followUpTaskHooks = {
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
