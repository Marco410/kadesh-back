import { list } from "@keystone-6/core";
import { checkbox, relationship, text, timestamp } from "@keystone-6/core/fields";
import { getSessionUserId } from "../../../utils/access/tenant";
import { saasCompanyNoteAccess } from "./SaasCompanyNote.access";

/**
 * Notas internas de Kadesh sobre una empresa (llamadas, acuerdos, por qué se le dio una prueba
 * más larga…). El cliente nunca las ve. El autor lo pone el servidor.
 */
export default list({
  access: saasCompanyNoteAccess,
  hooks: {
    resolveInput: {
      create: ({ resolvedData, context }) => {
        const userId = getSessionUserId(context.session as any);
        return userId ? { ...resolvedData, author: { connect: { id: userId } } } : resolvedData;
      },
    },
  },
  ui: {
    listView: {
      initialColumns: ["createdAt", "company", "author", "pinned", "body"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  fields: {
    company: relationship({
      ref: "SaasCompany",
      many: false,
      ui: { description: "Empresa de la nota" },
    }),
    author: relationship({
      ref: "User",
      many: false,
      ui: { description: "Quién la escribió (lo pone el servidor)", createView: { fieldMode: "hidden" } },
    }),
    body: text({
      validation: { isRequired: true, length: { max: 4000 } },
      ui: { displayMode: "textarea" },
    }),
    pinned: checkbox({
      defaultValue: false,
      ui: { description: "Fijada arriba en el 360" },
    }),
    createdAt: timestamp({ defaultValue: { kind: "now" }, isIndexed: true }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
});
