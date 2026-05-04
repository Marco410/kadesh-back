import { list } from "@keystone-6/core";
import {
  text,
  float,
  integer,
  checkbox,
  timestamp,
  select,
  relationship,
} from "@keystone-6/core/fields";
import { businessLeadAccess } from "./TechBusinessLead.access";
import { businessLeadHooks } from "./TechBusinessLead.hooks";
import { LEAD_SOURCE } from "../crm/constants";

const sourceOptions = Object.entries(LEAD_SOURCE).map(([k, v]) => ({
  label: v,
  value: v,
}));

export default list({
  access: businessLeadAccess,
  hooks: businessLeadHooks,
  ui: {
    labelField: "businessName",
    listView: {
      initialColumns: [
        "businessName",
        "category",
        "status",
        "salesPerson",
      ],
    },
  },
  fields: {
    businessName: text({
      validation: { isRequired: true },
      isIndexed: true,
    }),
    category: text({ isIndexed: true }),
    phone: text(),
    email: text(),
    address: text(),
    city: text({ isIndexed: true }),
    state: text({ isIndexed: true }),
    country: text({ isIndexed: true }),
    rating: float(),
    lat: float(),
    lng: float(),
    reviewCount: integer({ ui: { description: "Número de reseñas" } }),
    hasWebsite: checkbox({
      defaultValue: false,
      ui: { description: "Tiene sitio web" },
    }),
    websiteUrl: text(),
    source: select({
      type: "string",
      options: sourceOptions,
      defaultValue: "Google Maps",
      ui: { description: "Fuente del lead" },
    }),
    status: relationship({
      ref: "TechStatusBusinessLead.businessLead",
      many: true,
      ui: { description: "Estado y datos variables del lead" },
    }),
    instagram: text({ ui: { description: "Usuario o URL de Instagram" } }),
    facebook: text({ ui: { description: "URL de Facebook" } }),
    xTwitter: text({ ui: { description: "Usuario o URL de X (Twitter)" } }),
    tiktok: text({ ui: { description: "Usuario o URL de TikTok" } }),
    // Reseñas de Google (máx. 5 positivas) para uso en prompt de IA
    topReview1: text({
      ui: { displayMode: "textarea", description: "Mejor reseña 1 (Google)" },
    }),
    topReview2: text({
      ui: { displayMode: "textarea", description: "Mejor reseña 2 (Google)" },
    }),
    topReview3: text({
      ui: { displayMode: "textarea", description: "Mejor reseña 3 (Google)" },
    }),
    topReview4: text({
      ui: { displayMode: "textarea", description: "Mejor reseña 4 (Google)" },
    }),
    topReview5: text({
      ui: { displayMode: "textarea", description: "Mejor reseña 5 (Google)" },
    }),
    // Prompt listo para copiar y usar en vibe coding / IA (info del negocio + reseñas)
    websitePromptContent: text({
      ui: {
        displayMode: "textarea",
        description:
          "Prompt listo para IA: crear sitio web con la info del negocio y las 5 reseñas positivas de Google. Copiar y pegar en tu herramienta de vibe coding.",
      },
    }),
    // Relaciones inversas
    activities: relationship({
      ref: "TechSalesActivity.businessLead",
      many: true,
      ui: { hideCreate: true },
    }),
    tasks: relationship({
      ref: "TechTask.businessLead",
      many: true,
      ui: { hideCreate: true, description: "Tareas de workspace ligadas al lead" },
    }),
    proposals: relationship({
      ref: "TechProposal.businessLead",
      many: true,
      ui: { hideCreate: true },
    }),
    projects: relationship({
      ref: "SaasProject.businessLead",
      many: true,
      ui: { description: "Proyectos creados tras venta cerrada (cliente)" },
    }),
    followUpTasks: relationship({
      ref: "TechFollowUpTask.businessLead",
      many: true,
      ui: { hideCreate: true },
    }),
    googleMapsUrl: text({
      ui: { description: "URL de Google Maps del negocio" },
    }),
    // Para importación desde Google (opcional)
    googlePlaceId: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
      },
    }),
    salesPerson: relationship({
      ref: "User.businessLeadsAssigned",
      many: true,
      ui: { description: "Vendedor asignado" },
    }),
    saasCompany: relationship({
      ref: "SaasCompany.leads",
      many: true,
      ui: { description: "Empresa a la que pertenece el lead" },
    }),
    quotations: relationship({
      ref: "SaasQuotation.lead",
      many: true,
      ui: { description: "Cotizaciones ligadas a este lead" },
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
