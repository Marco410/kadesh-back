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
    labelField: "fullName",
    listView: {
      initialColumns: [
        "fullName",
        "businessName",
        "jobTitle",
        "industry",
        "email",
        "source",
        "salesPerson",
      ],
    },
  },
  fields: {
    // --- Contacto (prospección LinkedIn / B2B) ---
    firstName: text({ isIndexed: true }),
    lastName: text({ isIndexed: true }),
    fullName: text({
      isIndexed: true,
      ui: { description: "Nombre completo del contacto" },
    }),
    email: text({
      isIndexed: true,
      ui: { description: "Email laboral del contacto" },
    }),
    personalEmail: text({ ui: { description: "Email personal del contacto" } }),
    mobileNumber: text({ ui: { description: "Teléfono móvil del contacto" } }),
    phone: text({ ui: { description: "Teléfono (legacy / Google Maps)" } }),
    jobTitle: text({ isIndexed: true, ui: { description: "Puesto del contacto" } }),
    headline: text({
      ui: {
        displayMode: "textarea",
        description: "Headline de LinkedIn del contacto",
      },
    }),
    linkedin: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: { description: "URL de LinkedIn del contacto" },
    }),
    seniorityLevel: text({
      isIndexed: true,
      ui: { description: "Nivel de seniority (owner, founder, etc.)" },
    }),
    functionalLevel: text({
      ui: { description: "Nivel funcional (c_suite, product_management, etc.)" },
    }),
    // Ubicación del contacto
    city: text({ isIndexed: true, ui: { description: "Ciudad del contacto" } }),
    state: text({ isIndexed: true, ui: { description: "Estado del contacto" } }),
    country: text({ isIndexed: true, ui: { description: "País del contacto" } }),

    // --- Empresa ---
    businessName: text({
      isIndexed: true,
      ui: { description: "Nombre de la empresa (company_name)" },
    }),
    industry: text({
      isIndexed: true,
      ui: { description: "Industria de la empresa" },
    }),
    category: text({
      isIndexed: true,
      ui: { description: "Categoría (Google Maps / legacy)" },
    }),
    companySize: integer({ ui: { description: "Tamaño de la empresa (empleados)" } }),
    companyDescription: text({
      ui: {
        displayMode: "textarea",
        description: "Descripción de la empresa",
      },
    }),
    companyDomain: text({ ui: { description: "Dominio web de la empresa" } }),
    companyPhone: text({ ui: { description: "Teléfono de la empresa" } }),
    companyLinkedin: text({ ui: { description: "URL de LinkedIn de la empresa" } }),
    companyLinkedinUid: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description: "UID de LinkedIn de la empresa (deduplicación)",
      },
    }),
    companyFoundedYear: text({ ui: { description: "Año de fundación de la empresa" } }),
    companyAnnualRevenue: text({
      ui: { description: "Ingresos anuales (valor numérico en texto)" },
    }),
    companyAnnualRevenueClean: text({
      ui: { description: "Ingresos anuales (formato legible, ej. 1M, 33.8B)" },
    }),
    companyTotalFunding: text({ ui: { description: "Financiamiento total" } }),
    companyTotalFundingClean: text({
      ui: { description: "Financiamiento total (formato legible)" },
    }),
    keywords: text({
      ui: {
        displayMode: "textarea",
        description: "Keywords / tags de la empresa",
      },
    }),
    companyTechnologies: text({
      ui: {
        displayMode: "textarea",
        description: "Tecnologías que usa la empresa",
      },
    }),
    // Ubicación de la empresa
    companyStreetAddress: text({ ui: { description: "Calle de la empresa" } }),
    companyFullAddress: text({
      ui: { description: "Dirección completa de la empresa" },
    }),
    companyCity: text({ isIndexed: true, ui: { description: "Ciudad de la empresa" } }),
    companyState: text({ isIndexed: true, ui: { description: "Estado de la empresa" } }),
    companyCountry: text({ isIndexed: true, ui: { description: "País de la empresa" } }),
    companyPostalCode: text({ ui: { description: "Código postal de la empresa" } }),
    address: text({ ui: { description: "Dirección (legacy / Google Maps)" } }),

    // --- Web y fuente ---
    hasWebsite: checkbox({
      defaultValue: false,
      ui: { description: "Tiene sitio web" },
    }),
    websiteUrl: text({ ui: { description: "Sitio web de la empresa (company_website)" } }),
    source: select({
      type: "string",
      options: sourceOptions,
      defaultValue: LEAD_SOURCE.GOOGLE_MAPS,
      ui: { description: "Fuente del lead" },
    }),

    // --- Redes sociales ---
    instagram: text({ ui: { description: "Usuario o URL de Instagram" } }),
    facebook: text({ ui: { description: "URL de Facebook" } }),
    xTwitter: text({ ui: { description: "Usuario o URL de X (Twitter)" } }),
    tiktok: text({ ui: { description: "Usuario o URL de TikTok" } }),

    // --- Google Maps (legacy) ---
    rating: float(),
    lat: float(),
    lng: float(),
    reviewCount: integer({ ui: { description: "Número de reseñas" } }),
    googleMapsUrl: text({
      ui: { description: "URL de Google Maps del negocio" },
    }),
    googlePlaceId: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
      },
    }),
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
    websitePromptContent: text({
      ui: {
        displayMode: "textarea",
        description:
          "Prompt listo para IA: crear sitio web con la info del negocio y las 5 reseñas positivas de Google.",
      },
    }),

    // --- CRM ---
    status: relationship({
      ref: "TechStatusBusinessLead.businessLead",
      many: true,
      ui: { description: "Estado y datos variables del lead" },
    }),
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
