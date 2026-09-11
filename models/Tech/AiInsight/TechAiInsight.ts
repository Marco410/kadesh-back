import { list } from "@keystone-6/core";
import {
  json,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { techAiInsightAccess } from "./TechAiInsight.access";
import { AI_INSIGHT_KIND_OPTIONS } from "./constants";

export default list({
  access: techAiInsightAccess,
  ui: {
    listView: {
      initialColumns: [
        "generatedAt",
        "kind",
        "referenceKey",
        "company",
        "salesPerson",
      ],
    },
  },
  fields: {
    company: relationship({
      ref: "SaasCompany.aiInsights",
      many: false,
      ui: { description: "Empresa dueña del insight" },
    }),
    salesPerson: relationship({
      ref: "User.aiInsights",
      many: false,
      ui: {
        description:
          "Vendedor dueño del insight. Vacío = insight de empresa (admin / alcance global)",
      },
    }),
    kind: select({
      type: "string",
      options: [...AI_INSIGHT_KIND_OPTIONS],
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Tipo de insight (digest, narrativa, archivo)" },
    }),
    referenceKey: text({
      isIndexed: true,
      ui: {
        description:
          'Clave de caché: "YYYY-MM-DD", "YYYY-MM" o id de archivo',
      },
    }),
    content: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: "Texto legible del insight",
      },
    }),
    structuredData: json({
      ui: { description: "JSON de acciones / estructura (p. ej. 3 pasos)" },
    }),
    relatedFile: relationship({
      ref: "TechFile.aiInsights",
      many: false,
      ui: { description: "Archivo analizado (Fase 4)" },
    }),
    generatedAt: timestamp({
      defaultValue: { kind: "now" },
      ui: { description: "Momento en que se generó o regeneró" },
    }),
  },
});
