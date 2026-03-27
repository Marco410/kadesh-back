import { list } from "@keystone-6/core";
import {
  text,
  timestamp,
  calendarDay,
  relationship,
  json,
  file,
} from "@keystone-6/core/fields";
import { saasCompanyAccess } from "./SaasCompany.access";
import { saasCompanySubscriptionHook } from "./SaasCompany.hooks";

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
      ui: { description: "Per-month lead sync usage (for quota enforcement)" },
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
    quotations: relationship({
      ref: "SaasQuotation.company",
      many: true,
      ui: { description: "Cotizaciones de la empresa" },
    }),
    logo: file({
      storage: "s3_company_logo",
      ui: { description: "Logo de la empresa" },
    }),
    /** Onboarding — Pregunta 1 (Qué): oferta principal en 1–2 oraciones; contexto de industria y vocabulario para la IA. */
    onboardingMainOffer: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description:
          'Pregunta de oro 1 — El "Qué": ¿En una o dos oraciones, qué servicio o producto principal vendes?',
      },
    }),
    /** Onboarding — Pregunta 2 (Quién): cliente ideal / ICP; cruza con GOOGLE_PLACE_CATEGORIES. */
    onboardingIdealCustomer: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description:
          'Pregunta de oro 2 — El "Quién": ¿Quién es el cliente que más te compra o con el que prefieres trabajar? (ej. clínicas dentales, constructoras).',
      },
    }),
    /** Onboarding — Pregunta 3 (Cuánto): ticket promedio o valor que generas/ahorras; base para ROI en copy de la IA. */
    onboardingAvgTicketValue: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description:
          'Pregunta de oro 3 — El "Cuánto": ¿Cuál es el precio promedio de tu servicio, o cuánto dinero le haces ganar o ahorrar a tus clientes?',
      },
    }),
    /** Onboarding — Pregunta 4 (Cómo): adquisición actual y dolor al vender; cuello de botella para guiones y seguimiento. */
    onboardingSalesPain: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description:
          'Pregunta de oro 4 — El "Cómo": ¿Cómo consigues clientes hoy y qué es lo que más te cuesta al vender?',
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
