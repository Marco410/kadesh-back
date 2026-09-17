import { list } from "@keystone-6/core";
import { select, text } from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";
import { TYPES_PET_SHELTER } from "../../../utils/constants/constants";

const PET_PLACE_TYPE_OPTIONS = TYPES_PET_SHELTER.map((type) => ({
  label: type.label,
  value: type.value,
}));

const labelHook = {
  resolveInput: async ({ resolvedData, item }: any) => {
    if (resolvedData.value) {
      const typeData = TYPES_PET_SHELTER.find((t) => t.value === resolvedData.value);
      return typeData ? typeData.label : resolvedData.label || item?.label;
    }
    return resolvedData.label || item?.label;
  },
};

const pluralHook = {
  resolveInput: async ({ resolvedData, item }: any) => {
    if (resolvedData.value) {
      const typeData = TYPES_PET_SHELTER.find((t) => t.value === resolvedData.value);
      return typeData ? typeData.plural : resolvedData.plural || item?.plural;
    }
    return resolvedData.plural || item?.plural;
  },
};

export default list({
  access,
  fields: {
    value: select({
      validation: { isRequired: true },
      isIndexed: "unique",
      options: PET_PLACE_TYPE_OPTIONS,
    }),
    label: text({
      isIndexed: "unique",
      hooks: labelHook,
      ui: {
        itemView: { fieldMode: "read" },
      },
    }),
    plural: text({
      hooks: pluralHook,
      ui: {
        itemView: { fieldMode: "read" },
      },
    }),
  },
  ui: {
    labelField: "label",
  },
});
