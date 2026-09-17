import { validateTechStatusCrmInput } from "../../../utils/validation/validateTechStatusCrm";

export const salesActivityHooks = {
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
      listKey: "TechSalesActivity",
      addValidationError,
    });
  },
};
