import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { animalUserRowAccess, forceSessionUser } from "../Animal.access";
import { notifyAnimalComment } from "../../../../utils/notifications/animalReportAlerts";
import { ANIMAL_COMMENT_KIND, ANIMAL_COMMENT_KIND_OPTIONS } from "./constants";

export default list({
  access: animalUserRowAccess,
  hooks: {
    resolveInput: ({ resolvedData, operation, context }) =>
      forceSessionUser(resolvedData, operation, context),
    afterOperation: async ({ operation, item, context }) => {
      if (operation !== "create" || !item?.id) return;
      // Sin await: el aviso no frena el comentario.
      void notifyAnimalComment(context, {
        commentId: String(item.id),
        animalId: (item as any).animalId ?? null,
        authorId: (item as any).userId ?? null,
        kind: (item as any).kind ?? ANIMAL_COMMENT_KIND.COMMENT,
        comment: (item as any).comment ?? "",
      });
    },
  },
  fields: {
    comment: text({
      validation: { isRequired: true },
      ui: { displayMode: "textarea" },
    }),
    /**
     * `duplicate_report`: quien iba a publicar el mismo animal comentó aquí en vez de duplicarlo.
     * `possible_match`: alguien con un reporte del otro lado (perdido/encontrado) cree que es el mismo.
     */
    kind: select({
      options: ANIMAL_COMMENT_KIND_OPTIONS,
      defaultValue: ANIMAL_COMMENT_KIND.COMMENT,
      validation: { isRequired: true },
    }),
    animal: relationship({
      ref: "Animal",
      many: false,
    }),
    user: relationship({
      ref: "User",
      many: false,
    }),
    createdAt: timestamp({
      defaultValue: {
        kind: "now",
      },
    }),
  },
});
