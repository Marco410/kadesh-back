import { validateTechStatusCrmInput } from "../../../utils/validation/validateTechStatusCrm";

export const techTaskHooks = {
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
      listKey: "TechTask",
      addValidationError,
    });
  },
};
