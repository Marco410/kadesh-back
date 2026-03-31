import { list } from "@keystone-6/core";
import { text, float, timestamp, select, relationship } from "@keystone-6/core/fields";
import { quotationProductAccess } from "./SaasQuotationProduct.access";
import { quotationProductHooks } from "./SaasQuotationProduct.hooks";
import {
  QUOTATION_DISCOUNT_TYPE,
  QUOTATION_DISCOUNT_TYPE_OPTIONS,
} from "../SaasQuotation.constants";

export default list({
  access: quotationProductAccess,
  hooks: quotationProductHooks,
  ui: {
    listView: {
      initialColumns: ["quotation", "description", "quantity", "unitPrice", "lineTotal"],
    },
  },
  fields: {
    quotation: relationship({
      ref: "SaasQuotation.quotationProducts",
      many: false,
      ui: { description: "Cotización" },
    }),
    description: text({
      validation: { isRequired: true },
      ui: {
        displayMode: "textarea",
        description: "Concepto: servicio, producto, horas, paquete, etc.",
      },
    }),
    quantity: float({
      defaultValue: 1,
      ui: { description: "Cantidad (puede ser fracción, ej. horas)" },
    }),
    unitPrice: float({
      defaultValue: 0,
      ui: { description: "Precio unitario" },
    }),
    discountType: select({
      type: "string",
      options: [...QUOTATION_DISCOUNT_TYPE_OPTIONS],
      defaultValue: QUOTATION_DISCOUNT_TYPE.NONE,
      ui: { description: "Tipo de descuento en la línea" },
    }),
    discountValue: float({
      defaultValue: 0,
      ui: {
        description:
          "Descuento: porcentaje (0–100) si tipo es porcentaje; monto si tipo es monto fijo",
      },
    }),
    taxRate: float({
      defaultValue: 0,
      ui: { description: "Tasa de impuesto en % (ej. 16 para IVA)" },
    }),
    lineSubtotal: float({
      defaultValue: 0,
      ui: {
        description: "Subtotal línea sin impuesto (cantidad × precio − descuento)",
      },
    }),
    lineTotal: float({
      defaultValue: 0,
      ui: { description: "Total línea con impuesto" },
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
