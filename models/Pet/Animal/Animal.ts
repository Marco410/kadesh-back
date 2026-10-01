import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import access from "../../../utils/generalAccess/access";
import { ANIMAL_SEX_OPTIONS } from "../../../utils/constants/constants";
import { animalCreateSideEffectsHook } from "./Animal.hooks";
import { normalizeMxPhone } from "../../../utils/pet/phone";

export default list({
  access,
  hooks: {
    resolveInput: ({ resolvedData }) => {
      const data = { ...resolvedData };
      for (const key of ["contactNumber", "contactNumber2"] as const) {
        if (!(key in data) || data[key] == null) continue;
        const raw = String(data[key]);
        if (!raw.trim()) {
          data[key] = "";
          continue;
        }
        const phone = normalizeMxPhone(raw);
        if (phone.ok) data[key] = phone.digits;
      }
      return data;
    },
    validateInput: ({ resolvedData, addValidationError }) => {
      for (const key of ["contactNumber", "contactNumber2"] as const) {
        if (!(key in resolvedData) || resolvedData[key] == null) continue;
        const raw = String(resolvedData[key]).trim();
        if (!raw) continue;
        const phone = normalizeMxPhone(raw);
        if (!phone.ok) {
          console.error("[animal] validación Keystone", {
            field: key,
            reason: phone.reason,
            raw,
          });
          addValidationError(phone.reason);
        }
      }
    },
    ...animalCreateSideEffectsHook,
  },
  ui: {
    listView: {
      initialColumns: ["name", "slug", "createdAt"],
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "URL amigable. Se genera sola y no cambia si editas el nombre.",
      },
    }),
    physical_description: text(),
    age: text(),
    sex: select({
      options: ANIMAL_SEX_OPTIONS,
      defaultValue: "male",
    }),
    color: text(),
    size: text(),
    contactNumber: text(),
    contactNumber2: text({
      ui: { description: "Segundo teléfono, opcional." },
    }),
    sourceUrl: text({
      ui: { description: "Enlace de la publicación original, por ejemplo de Facebook." },
    }),
    reportedBy: select({
      options: [
        { label: "Dueño", value: "owner" },
        { label: "Voluntario", value: "volunteer" },
      ],
      defaultValue: "owner",
      ui: {
        description: "owner publica su mascota. volunteer reporta por alguien más.",
      },
    }),
    animal_type: relationship({
      ref: "AnimalType",
      many: false,
    }),
    animal_breed: relationship({
      ref: "AnimalBreed",
      many: false,
    }),
    user: relationship({
      ref: "User",
      many: false,
    }),
    multimedia: relationship({
      ref: "AnimalMultimedia.animal",
      many: true,
    }),
    logs: relationship({
      ref: "AnimalLog.animal",
      many: true,
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
  },
});
