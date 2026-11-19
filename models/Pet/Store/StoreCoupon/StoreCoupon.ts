import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";
import { STORE_COUPON_CODE_MAX, STORE_COUPON_TYPE, STORE_COUPON_TYPE_OPTIONS } from "../constants";

/** "  verano 10 " → "VERANO10": how a code is stored and compared. */
export function normalizeCouponCode(code: string | null | undefined): string {
  return (code ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, STORE_COUPON_CODE_MAX);
}

/**
 * A discount code of the store. Checked and applied by `utils/store/coupons.ts` when the cart is
 * quoted and when the order is placed.
 *
 * With no categories and no products it applies to the whole cart; with either, only to those
 * lines. `usedCount` is kept by the server (one conditional increment per order), so a coupon with
 * a limit cannot be used past it by two people at once.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 100 },
  ui: {
    labelField: "code",
    listView: { initialColumns: ["code", "type", "value", "usedCount", "usageLimit", "isActive", "endsAt"] },
  },
  hooks: {
    resolveInput: ({ resolvedData, operation }: any) => {
      const data = { ...resolvedData };
      if (typeof data.code === "string") data.code = normalizeCouponCode(data.code);
      // Kept by the server: a value sent through the API is dropped.
      if (operation === "update") delete data.usedCount;
      else data.usedCount = 0;
      return data;
    },
    validateInput: ({ operation, resolvedData, item, addValidationError }: any) => {
      if (operation === "delete") return;
      const pick = (field: string) => (resolvedData[field] !== undefined ? resolvedData[field] : item?.[field]);
      if (!pick("code")) addValidationError("Escribe el código del cupón (letras y números).");
      const type = pick("type");
      const value = Number(pick("value")) || 0;
      if (type === STORE_COUPON_TYPE.PERCENT && (value < 1 || value > 100)) {
        addValidationError("El porcentaje debe ir de 1 a 100.");
      }
      if (type === STORE_COUPON_TYPE.FIXED && value < 1) {
        addValidationError("Escribe el monto del descuento.");
      }
      for (const field of ["minSubtotalCents", "maxDiscountCents", "usageLimit", "usageLimitPerUser"]) {
        const number = pick(field);
        if (typeof number === "number" && number < 0) addValidationError(`${field} no puede ser negativo.`);
      }
      const startsAt = pick("startsAt");
      const endsAt = pick("endsAt");
      if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        addValidationError("La fecha de fin debe ser posterior a la de inicio.");
      }
    },
  },
  fields: {
    code: text({ isIndexed: "unique", validation: { isRequired: true } }),
    description: text({ ui: { description: "Interna: para qué es este cupón." } }),
    type: select({
      type: "string",
      options: STORE_COUPON_TYPE_OPTIONS,
      defaultValue: STORE_COUPON_TYPE.PERCENT,
      validation: { isRequired: true },
    }),
    value: integer({
      defaultValue: 0,
      validation: { isRequired: true },
      ui: { description: "Porcentaje (10 = 10 %) o centavos, según el tipo. Se ignora en envío gratis." },
    }),
    minSubtotalCents: integer({ ui: { description: "Subtotal mínimo del carrito para usarlo." } }),
    maxDiscountCents: integer({ ui: { description: "Tope del descuento (para porcentajes)." } }),
    startsAt: timestamp(),
    endsAt: timestamp(),
    usageLimit: integer({ ui: { description: "Usos en total. Vacío = sin límite." } }),
    usageLimitPerUser: integer({ ui: { description: "Usos por persona. Vacío = sin límite." } }),
    usedCount: integer({
      defaultValue: 0,
      validation: { isRequired: true },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
    }),
    firstOrderOnly: checkbox({ defaultValue: false, ui: { description: "Solo para quien no ha pagado ningún pedido." } }),
    isActive: checkbox({ defaultValue: true }),
    categories: relationship({ ref: "StoreCategory", many: true }),
    products: relationship({ ref: "StoreProduct", many: true }),
    redemptions: relationship({ ref: "StoreCouponRedemption.coupon", many: true }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
