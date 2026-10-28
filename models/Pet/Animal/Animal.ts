import { list } from "@keystone-6/core";
import { json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { animalAccess, forceAnimalOwner } from "./Animal.access";
import { ANIMAL_SEX_OPTIONS } from "../../../utils/constants/constants";
import { animalCreateSideEffectsHook } from "./Animal.hooks";
import { animalMergeAfterOperation, validateDuplicateOf } from "./Animal.merge";
import { normalizeMxPhone } from "../../../utils/pet/phone";
import { isPlatformAdmin } from "../../../utils/access/tenant";

const adminOnly = ({ session }: { session?: unknown }) => isPlatformAdmin(session as any);

/** Lo que manda la web al publicar «de todos modos»: ids y puntaje de los parecidos, nada más. */
function cleanDuplicateCheck(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const raw = value as { candidates?: unknown; dismissedAt?: unknown };
  const candidates = (Array.isArray(raw.candidates) ? raw.candidates : [])
    .map((candidate: any) => ({
      id: typeof candidate?.id === "string" ? candidate.id : "",
      score: Number(candidate?.score) || 0,
    }))
    .filter((candidate) => candidate.id)
    .slice(0, 6);
  if (!candidates.length) return null;
  return { candidates, dismissedAt: new Date().toISOString() };
}

export default list({
  access: animalAccess,
  hooks: {
    resolveInput: ({ resolvedData, operation, context }) => {
      const data = forceAnimalOwner({ ...resolvedData }, operation, context);
      if ("duplicateCheck" in data) data.duplicateCheck = cleanDuplicateCheck(data.duplicateCheck);
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
    validateInput: async ({ resolvedData, operation, item, context, addValidationError }) => {
      await validateDuplicateOf({ operation, resolvedData, item, context, addValidationError });
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
    afterOperation: async (args) => {
      await animalCreateSideEffectsHook.afterOperation(args);
      await animalMergeAfterOperation(args);
    },
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
    animal_views: relationship({
      ref: "AnimalView.animal",
      many: true,
    }),
    /** Registro de la publicación en la Página de Facebook de Pet (automática o desde Operaciones). */
    facebookPostId: text({
      ui: { itemView: { fieldMode: "read" }, description: "Id del post en la Página de Facebook de Pet" },
    }),
    facebookPublishedAt: timestamp({
      db: { isNullable: true },
      ui: { itemView: { fieldMode: "read" } },
    }),
    facebookPublishedBy: relationship({
      ref: "User",
      many: false,
      ui: { itemView: { fieldMode: "read" }, description: "Quién lo publicó en Facebook" },
    }),
    /**
     * Mascota de la cartilla que originó el reporte (`markPetAsLost`). Solo la escriben un admin y
     * las mutaciones de la cartilla; leerla pasa por el acceso de `Pet` (null si no eres dueño).
     */
    pet: relationship({
      ref: "Pet",
      many: false,
      access: {
        create: ({ session }) => isPlatformAdmin(session as any),
        update: ({ session }) => isPlatformAdmin(session as any),
      },
      ui: { description: "Mascota de la cartilla (si el reporte salió de ahí)" },
    }),
    /**
     * Reporte repetido de otro (el principal). Solo un admin lo pone: al guardarlo, los comentarios
     * y favoritos pasan al principal, la ficha redirige ahí y deja de salir en listados.
     */
    duplicateOf: relationship({
      ref: "Animal",
      many: false,
      access: { create: adminOnly, update: adminOnly },
      ui: { description: "Si es un reporte repetido, el reporte principal del mismo animal." },
    }),
    /** Parecidos que la persona vio y descartó al publicar. Pista para que un admin decida si unirlos. */
    duplicateCheck: json({
      access: { read: adminOnly, update: adminOnly },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "Reportes parecidos que se ignoraron al publicar.",
      },
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
