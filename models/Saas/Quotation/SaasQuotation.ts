import { list } from "@keystone-6/core";
import {
  text,
  float,
  timestamp,
  calendarDay,
  select,
  relationship,
  checkbox,
} from "@keystone-6/core/fields";
import { quotationAccess } from "./SaasQuotation.access";
import { quotationHooks } from "./SaasQuotation.hooks";
import {
  QUOTATION_STATUS,
  QUOTATION_STATUS_OPTIONS,
} from "./SaasQuotation.constants";

export default list({
  access: quotationAccess,
  hooks: quotationHooks,
  ui: {
    labelField: "quotationNumber",
    listView: {
      initialColumns: [
        "quotationNumber",
        "status",
        "company",
        "total",
        "currency",
        "validUntil",
        "createdBy",
      ],
    },
  },
  fields: {
    company: relationship({
      ref: "SaasCompany.quotations",
      many: false,
      ui: { description: "Empresa a la que pertenece la cotización" },
    }),
    lead: relationship({
      ref: "TechBusinessLead.quotations",
      many: false,
      ui: { description: "Lead asociado (opcional)" },
    }),
    project: relationship({
      ref: "SaasProject.quotations",
      many: false,
      ui: { description: "Proyecto asociado (opcional)" },
    }),
    quotationNumber: text({
      isIndexed: true,
      validation: { isRequired: true },
      ui: {
        description:
          "Consecutivo por empresa (ej. Q-2026-0012); se asigna al crear si se deja vacío",
      },
    }),
    status: select({
      type: "string",
      options: [...QUOTATION_STATUS_OPTIONS],
      defaultValue: QUOTATION_STATUS.DRAFT,
      isIndexed: true,
      ui: { description: "Estado de la cotización" },
    }),
    currency: text({
      defaultValue: "MXN",
      ui: { description: "Moneda (ISO o etiqueta interna)" },
    }),
    exchangeRate: float({
      defaultValue: 1,
      ui: { description: "Tipo de cambio respecto a moneda base (1 = sin conversión)" },
    }),
    subtotal: float({
      defaultValue: 0,
      ui: { description: "Subtotal antes de impuestos (suma de líneas netas)" },
    }),
    discountTotal: float({
      defaultValue: 0,
      ui: { description: "Total descuentos en líneas" },
    }),
    taxTotal: float({
      defaultValue: 0,
      ui: { description: "Total impuestos" },
    }),
    total: float({
      defaultValue: 0,
      ui: { description: "Total a pagar" },
    }),
    validUntil: calendarDay({
      db: { isNullable: true },
      ui: { description: "Vigencia de la cotización" },
    }),
    sentAt: timestamp({
      db: { isNullable: true },
      ui: { description: "Fecha de envío al cliente" },
    }),
    acceptedAt: timestamp({
      db: { isNullable: true },
      ui: { description: "Fecha de aceptación" },
    }),
    notes: text({
      db: { isNullable: true },
      ui: { displayMode: "textarea", description: "Notas internas o para el cliente" },
    }),
    terms: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: "Términos y condiciones mostrados en la cotización",
      },
    }),
    createdBy: relationship({
      ref: "User.quotationsCreated",
      many: false,
      ui: { description: "Usuario que creó el registro" },
    }),
    assignedSeller: relationship({
      ref: "User.quotationsAssignedSeller",
      many: false,
      ui: { description: "Vendedor asignado" },
    }),
    pdfFileOrUrl: text({
      db: { isNullable: true },
      ui: { description: "URL o clave del PDF generado (opcional)" },
    }),
    quotationProducts: relationship({
      ref: "SaasQuotationProduct.quotation",
      many: true,
      ui: { description: "Conceptos / partidas" },
    }),
    showDiscount: checkbox({
      defaultValue: true,
      ui: { description: "Mostrar descuento en la cotización" },
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
