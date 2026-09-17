import { list } from "@keystone-6/core";
import {
  text,
  timestamp,
  select,
  relationship,
  file,
} from "@keystone-6/core/fields";
import { techFilesAccess } from "./TechFiles.access";
import { hasRole } from "../../../../auth/permissions";
import { Role } from "../../../Role/constants";
import { getSessionCompanyId } from "../../../../utils/access/tenant";

const CATEGORY_OPTIONS = [
  { label: "Proceso de venta", value: "purchase_process" },
  { label: "Técnica de venta", value: "sales_technique" },
  { label: "Cierres", value: "closing" },
  { label: "Speech / Guion", value: "speech_script" },
  { label: "Otro", value: "other" },
] as const;

export default list({
  access: techFilesAccess,
  hooks: {
    resolveInput: async ({ resolvedData, context, operation }: any) => {
      if (hasRole(context.session, [Role.ADMIN])) return resolvedData;
      const companyId = getSessionCompanyId(context.session);
      if (operation === "create" && companyId) {
        return {
          ...resolvedData,
          company: { connect: { id: companyId } },
        };
      }
      const next = { ...resolvedData };
      delete next.company;
      return next;
    },
  },
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
    aiInsights: relationship({
      ref: "TechAiInsight.relatedFile",
      many: true,
      ui: { description: "Análisis de IA ligados a este archivo" },
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
