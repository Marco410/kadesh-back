import { list } from "@keystone-6/core";
import {
  text,
  timestamp,
  calendarDay,
  relationship,
  json,
  file,
  checkbox,
  integer,
  select,
} from "@keystone-6/core/fields";
import {
  saasCompanyAccess,
  aiApiKeyPreviewFieldAccess,
  whatsappTokenPreviewFieldAccess,
} from "./SaasCompany.access";
import { saasCompanySubscriptionHook } from "./SaasCompany.hooks";
import {
  AI_BILLING_MODE,
  AI_BILLING_MODE_OPTIONS,
  AI_PROVIDER_OPTIONS,
} from "../../../utils/ai/constants";

export default list({
  access: saasCompanyAccess,
  hooks: {
    afterOperation: saasCompanySubscriptionHook.afterOperation,
  },
  ui: {
    listView: {
      initialColumns: [
        "name",
        "plan",
        "subscriptions",
        "allowedGooglePlaceCategories",
        "subscriptionStartedAt",
        "users",
      ],
    },
  },
  fields: {
    /** Company / organization name */
    name: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Company or organization name" },
    }),
    /** Users belonging to this company (1 company : N users) */
    users: relationship({
      ref: "User.company",
      many: true,
      ui: { description: "Users belonging to this company" },
    }),
    workspaces: relationship({
      ref: "SaasWorkspace.company",
      many: true,
      ui: { description: "Espacios de trabajo (áreas) de la empresa" },
    }),

    allowedGooglePlaceCategories: json({
      ui: {
        description:
          'Allowed categories for lead sync. JSON array of category values from GOOGLE_PLACE_CATEGORIES (e.g. ["restaurantes", "cafeterías"]). Empty or null = all allowed.',
      },
    }),
    leads: relationship({
      ref: "TechBusinessLead.saasCompany",
      many: true,
      ui: { description: "Leads belonging to this company" },
    }),
    /** Current plan (e.g. Free, Starter). Updated when a new subscription is created. */
    plan: relationship({
      ref: "SaasPlan.companies",
      many: false,
      ui: { description: "Current plan for this company" },
    }),
    /** Date when the company started its first subscription (e.g. free trial). */
    subscriptionStartedAt: calendarDay({
      db: { isNullable: true },
      ui: { description: "Date when the first subscription started" },
    }),
    /** Paid subscriptions (each record has a snapshot of the plan at contract time, no relation to SaasPlan) */
    subscriptions: relationship({
      ref: "SaasCompanySubscription.company",
      many: true,
      ui: {
        description:
          "Subscription history; plan data is stored as snapshot per record",
      },
    }),
    techStatusBusinessLeads: relationship({
      ref: "TechStatusBusinessLead.saasCompany",
      many: true,
      ui: { description: "Estados de los leads pertenecientes a esta company" },
    }),
    /** Monthly lead sync usage records (count of leads synced per month) */
    monthlyLeadSyncRecords: relationship({
      ref: "SaasCompanyMonthlyLeadSync.company",
      many: true,
      ui: { description: "Per-month lead sync usage (legacy quota tracking)" },
    }),
    /** Cumulative purchased bonus credits (permanent monthly top-up) */
    purchasedBonusCredits: integer({
      defaultValue: 0,
      ui: {
        description:
          "Total extra credits purchased; added to the monthly allowance each period",
      },
    }),
    creditPeriods: relationship({
      ref: "SaasCompanyCreditPeriod.company",
      many: true,
      ui: { description: "Monthly credit periods for this company" },
    }),
    creditLedgerEntries: relationship({
      ref: "SaasCompanyCreditLedger.company",
      many: true,
      ui: { description: "Credit grant/consume ledger for this company" },
    }),
    techFiles: relationship({
      ref: "TechFile.company",
      many: true,
      ui: { description: "Archivos y materiales para el equipo de ventas" },
    }),
    projects: relationship({
      ref: "SaasProject.company",
      many: true,
      ui: { description: "Proyectos o servicios de la empresa" },
    }),
    leadSyncLogs: relationship({
      ref: "TechLeadSyncLog.company",
      many: true,
      ui: { description: "Logs de sincronización de leads" },
    }),
    aiCallLogs: relationship({
      ref: "TechAiCallLog.company",
      many: true,
      ui: { description: "Historial de llamadas a IA (prompts, tokens, créditos)" },
    }),
    aiInsights: relationship({
      ref: "TechAiInsight.company",
      many: true,
      ui: { description: "Insights de IA (digest diario, narrativa, archivos)" },
    }),
    saasSubscriptionLogs: relationship({
      ref: "SaasSubscriptionLog.company",
      many: true,
      ui: { description: "Logs de intentos de contratación de plan" },
    }),
    quotations: relationship({
      ref: "SaasQuotation.company",
      many: true,
      ui: { description: "Cotizaciones de la empresa" },
    }),
    logo: file({
      storage: "s3_company_logo",
      ui: { description: "Logo de la empresa" },
    }),
    onboardingMainOffer: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description:
          'Pregunta de oro 1 — El "Qué": ¿En una o dos oraciones, qué servicio o producto principal vendes?',
      },
    }),
    onboardingIdealCustomer: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description:
          'Pregunta de oro 2 — El "Quién": ¿Quién es el cliente que más te compra o con el que prefieres trabajar? (ej. clínicas dentales, constructoras).',
      },
    }),
    onboardingAvgTicketValue: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description:
          'Pregunta de oro 3 — El "Cuánto": ¿Cuál es el precio promedio de tu servicio, o cuánto dinero le haces ganar o ahorrar a tus clientes?',
      },
    }),
    onboardingSalesPain: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description:
          'Pregunta de oro 4 — El "Cómo": ¿Cómo consigues clientes hoy y qué es lo que más te cuesta al vender?',
      },
    }),
    aiBillingMode: select({
      type: "string",
      options: [...AI_BILLING_MODE_OPTIONS],
      defaultValue: AI_BILLING_MODE.BYOK,
      ui: {
        description:
          "Cómo paga la empresa la IA: API key propia (BYOK) o créditos administrados por Kadesh",
      },
    }),
    aiProvider: select({
      type: "string",
      options: [...AI_PROVIDER_OPTIONS],
      db: { isNullable: true },
      ui: {
        description: "Proveedor de IA en modalidad BYOK (Claude, OpenAI o Gemini)",
      },
    }),
    aiModel: text({
      db: { isNullable: true },
      ui: {
        description:
          "Override opcional del modelo. Vacío = default del proveedor.",
      },
    }),
    aiApiKeyEncrypted: text({
      db: { isNullable: true },
      access: {
        read: () => false,
        create: () => false,
        update: () => false,
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description: "API key cifrada (solo mutaciones custom vía sudo)",
      },
    }),
    aiApiKeyPreview: text({
      db: { isNullable: true },
      access: aiApiKeyPreviewFieldAccess,
      ui: {
        description: "Vista enmascarada de la API key (ej. sk-ant...wXyz)",
      },
    }),
    aiKeyUpdatedAt: timestamp({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        description: "Última vez que se guardó o borró la API key de IA",
      },
    }),
    whatsappPhoneNumberId: text({
      db: { isNullable: true },
      isIndexed: "unique",
      ui: {
        description:
          "Phone Number ID de WhatsApp Cloud API (Meta). Único por empresa: se usa para enrutar el webhook entrante.",
      },
    }),
    whatsappBusinessAccountId: text({
      db: { isNullable: true },
      isIndexed: "unique",
      ui: {
        description:
          "WhatsApp Business Account ID (WABA). Único por empresa: se usa para enrutar el webhook de estado de plantillas.",
      },
    }),
    whatsappDisplayPhoneNumber: text({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        description: "Número mostrado por Meta (se llena al probar la conexión)",
      },
    }),
    whatsappAccessTokenEncrypted: text({
      db: { isNullable: true },
      access: {
        read: () => false,
        create: () => false,
        update: () => false,
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description: "Access token cifrado (solo mutaciones custom vía sudo)",
      },
    }),
    whatsappAppSecretEncrypted: text({
      db: { isNullable: true },
      access: {
        read: () => false,
        create: () => false,
        update: () => false,
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description:
          "App Secret de la App de Meta de esta empresa, cifrado. Verifica la firma del webhook entrante.",
      },
    }),
    whatsappTokenPreview: text({
      db: { isNullable: true },
      access: whatsappTokenPreviewFieldAccess,
      ui: {
        description: "Vista enmascarada del access token (ej. EAAxyz...wXyz)",
      },
    }),
    whatsappConnectedAt: timestamp({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        description: "Última vez que se conectó o desconectó WhatsApp",
      },
    }),
    whatsappAppId: text({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        description: "App ID de la App de Meta de esta empresa (para configurar su webhook por API)",
      },
    }),
    whatsappWebhookConfiguredAt: timestamp({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "Cuándo Kadesh dejó configurado el webhook de su App por API (no implica que ya lleguen mensajes)",
      },
    }),
    whatsappLastWebhookAt: timestamp({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "Último evento real de mensajes recibido con firma válida. Vacío = nunca ha llegado uno (¿App sin publicar en modo Live?)",
      },
    }),
    googleCalendarAccounts: relationship({
      ref: "GoogleCalendarAccount.company",
      many: true,
      ui: { hideCreate: true, description: "Cuentas de Google Calendar compartidas por la empresa" },
    }),
    calendarEvents: relationship({
      ref: "TechCalendarEvent.company",
      many: true,
      ui: { hideCreate: true, description: "Eventos de calendario de la empresa" },
    }),
    whatsappMessages: relationship({
      ref: "TechWhatsAppMessage.company",
      many: true,
      ui: { description: "Historial de mensajes de WhatsApp de esta empresa" },
    }),
    whatsappTemplateName: text({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "Nombre de la plantilla creada automáticamente para iniciar conversaciones",
      },
    }),
    whatsappTemplateLanguage: text({
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
    whatsappTemplateStatus: select({
      type: "string",
      options: [
        { label: "Ninguna", value: "none" },
        { label: "Pendiente de aprobación", value: "pending" },
        { label: "Aprobada", value: "approved" },
        { label: "Rechazada", value: "rejected" },
      ],
      defaultValue: "none",
      ui: {
        description:
          "Estado de la plantilla para iniciar conversaciones. Se crea sola al probar la conexión, y se actualiza vía webhook cuando Meta la revisa o releyéndolo de Meta en cada prueba de conexión (por si el webhook no está configurado).",
      },
    }),
    termsQuotation: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: "Términos y condiciones de la cotización",
      },
    }),
    colorPrimary: text({
      db: { isNullable: true },
      defaultValue: "#F7945E",
      ui: {
        description: "Color primario de la empresa",
      },
    }),
    colorSecondary: text({
      db: { isNullable: true },
      defaultValue: "#E07C3A",
      ui: {
        description: "Color secundario de la empresa",
      },
    }),
    contactEmail: text({
      db: { isNullable: true },
      ui: {
        description: "Correo electrónico de contacto de la empresa",
      },
    }),
    contactPhone: text({
      db: { isNullable: true },
      ui: {
        description: "Teléfono de contacto de la empresa",
      },
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
