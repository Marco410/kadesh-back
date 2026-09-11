import { list } from "@keystone-6/core";
import {
  checkbox,
  integer,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { techAiCallLogAccess, aiCallLogPromptFieldAccess } from "./TechAiCallLog.access";
import {
  AI_BILLING_MODE_OPTIONS,
  AI_PROVIDER_OPTIONS,
} from "../../../utils/ai/constants";

export default list({
  access: techAiCallLogAccess,
  ui: {
    listView: {
      initialColumns: [
        "createdAt",
        "company",
        "user",
        "feature",
        "provider",
        "model",
        "inputTokens",
        "outputTokens",
        "creditsCharged",
        "success",
      ],
    },
  },
  fields: {
    user: relationship({
      ref: "User.aiCallLogs",
      many: false,
      ui: { description: "Usuario que disparó la llamada" },
    }),
    company: relationship({
      ref: "SaasCompany.aiCallLogs",
      many: false,
      ui: { description: "Empresa dueña de Kadesh Urim AI" },
    }),
    feature: text({
      db: { isNullable: true },
      isIndexed: true,
      ui: {
        description:
          "Origen de la llamada (connection_test, daily_digest, monthly_narrative, file_analysis)",
      },
    }),
    billingMode: select({
      type: "string",
      options: [...AI_BILLING_MODE_OPTIONS],
      db: { isNullable: true },
      ui: { description: "byok o managed al momento de la llamada" },
    }),
    provider: select({
      type: "string",
      options: [...AI_PROVIDER_OPTIONS],
      db: { isNullable: true },
      ui: { description: "Proveedor usado" },
    }),
    model: text({
      db: { isNullable: true },
      ui: { description: "Modelo usado" },
    }),
    featurePrompt: text({
      db: { isNullable: true },
      access: aiCallLogPromptFieldAccess,
      ui: {
        displayMode: "textarea",
        description: "Instrucción de la feature (parte del system prompt)",
      },
    }),
    systemPrompt: text({
      db: { isNullable: true },
      access: aiCallLogPromptFieldAccess,
      ui: {
        displayMode: "textarea",
        description: "System prompt completo enviado al proveedor (Cerebro + feature)",
      },
    }),
    userPrompt: text({
      db: { isNullable: true },
      access: aiCallLogPromptFieldAccess,
      ui: {
        displayMode: "textarea",
        description: "Prompt de usuario enviado al proveedor",
      },
    }),
    response: text({
      db: { isNullable: true },
      access: aiCallLogPromptFieldAccess,
      ui: {
        displayMode: "textarea",
        description: "Texto que devolvió la IA",
      },
    }),
    inputTokens: integer({
      defaultValue: 0,
      ui: { description: "Tokens de entrada reportados por el proveedor" },
    }),
    outputTokens: integer({
      defaultValue: 0,
      ui: { description: "Tokens de salida reportados por el proveedor" },
    }),
    billableTokens: integer({
      defaultValue: 0,
      ui: {
        description: "Tokens equivalentes: input + output × 5",
      },
    }),
    creditsCharged: integer({
      defaultValue: 0,
      ui: { description: "Créditos debitados de la bolsa de la empresa" },
    }),
    billed: checkbox({
      defaultValue: false,
      ui: { description: "Si esta llamada debía cobrar créditos (managed y no ping)" },
    }),
    success: checkbox({
      defaultValue: false,
      ui: { description: "Si el proveedor respondió y se devolvió texto" },
    }),
    errorMessage: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: "Error si la llamada falló (sin API keys)",
      },
    }),
    durationMs: integer({
      db: { isNullable: true },
      ui: { description: "Duración total de callCompanyAi en ms" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: { description: "Momento de la llamada" },
    }),
  },
});
