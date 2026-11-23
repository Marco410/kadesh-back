import { list } from "@keystone-6/core";
import { checkbox, integer, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";
import { resetStoreSettingsCache } from "../../../../utils/store/settings";
import { STORE_SETTINGS_DEFAULTS } from "../constants";

/**
 * Settings of the store that the team changes without a deploy: shipping, payment methods and the
 * bank account for transfers. One row (singleton). Read with `getStoreSettings`, which keeps it in
 * memory for a minute.
 *
 * Whether the store is open at all is not here: that is the `STORE_ENABLED` env var.
 */
export default list({
  access: adminOnlyAccess,
  isSingleton: true,
  // The list key already reads as a plural: Keystone needs a different name for the plural query.
  graphql: { plural: "ManyStoreSettings" },
  hooks: {
    afterOperation: async () => {
      resetStoreSettingsCache();
    },
  },
  fields: {
    shippingFlatCents: integer({
      defaultValue: STORE_SETTINGS_DEFAULTS.shippingFlatCents,
      validation: { isRequired: true, min: 0 },
      ui: { description: "Envío por pedido, en centavos." },
    }),
    freeShippingMinCents: integer({
      defaultValue: STORE_SETTINGS_DEFAULTS.freeShippingMinCents,
      validation: { min: 0 },
      ui: { description: "Desde este subtotal el envío es gratis. Vacío o 0 = nunca." },
    }),
    cardEnabled: checkbox({ defaultValue: STORE_SETTINGS_DEFAULTS.cardEnabled }),
    transferEnabled: checkbox({ defaultValue: STORE_SETTINGS_DEFAULTS.transferEnabled }),
    bankName: text(),
    bankBeneficiary: text(),
    bankClabe: text({ ui: { description: "18 dígitos." } }),
    bankNote: text({ ui: { displayMode: "textarea", description: "Indicaciones extra para quien transfiere." } }),
    transferExpiryHours: integer({
      defaultValue: STORE_SETTINGS_DEFAULTS.transferExpiryHours,
      validation: { isRequired: true, min: 1, max: 240 },
    }),
    cardExpiryMinutes: integer({
      defaultValue: STORE_SETTINGS_DEFAULTS.cardExpiryMinutes,
      validation: { isRequired: true, min: 10, max: 1440 },
    }),
    returnPolicy: text({ ui: { displayMode: "textarea" } }),
    supportWhatsapp: text({ ui: { description: "10 dígitos, para dudas de un pedido." } }),
    updatedAt: timestamp({ defaultValue: { kind: "now" }, db: { updatedAt: true } }),
  },
});
