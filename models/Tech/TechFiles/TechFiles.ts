import { list } from "@keystone-6/core";
import {
  text,
  timestamp,
  select,
  relationship,
  file,
} from "@keystone-6/core/fields";
import { techFilesAccess } from "./TechFiles.access";

const CATEGORY_OPTIONS = [
  { label: "Proceso de venta", value: "purchase_process" },
  { label: "Técnica de venta", value: "sales_technique" },
  { label: "Cierres", value: "closing" },
  { label: "Speech / Guion", value: "speech_script" },
  { label: "Otro", value: "other" },
] as const;

export default list({
  access: techFilesAccess,
  ui: {
    listView: {
      initialColumns: ["title", "category", "company", "createdAt"],
    },
  },
  fields: {
    title: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Nombre del archivo o recurso" },
    }),
    description: text({
      ui: {
        displayMode: "textarea",
        description: "Descripción opcional del contenido",
      },
    }),
    category: select({
      type: "string",
      options: [...CATEGORY_OPTIONS],
      defaultValue: "otro",
      isIndexed: true,
      ui: {
        description: "Tipo de material (proceso, técnica, cierre, speech, etc.)",
      },
    }),
    file: file({
      storage: "s3_tech_files",
      ui: { description: "Archivo (PDF, DOC, etc.)" },
    }),
    company: relationship({
      ref: "SaasCompany.techFiles",
      many: false,
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
    updatedAt: timestamp({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "read" },
      },
    }),
  },
});
