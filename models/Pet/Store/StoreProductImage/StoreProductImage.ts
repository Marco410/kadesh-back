import { list } from "@keystone-6/core";
import { image, integer, relationship, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";
import { isHttpsUrl } from "../../../../utils/store/catalog";
import { bumpStoreCatalogVersion } from "../../../../utils/store/config";

/**
 * Photos of a product (`order` 1 = cover). Either an uploaded `image` (R2, signed URL) or an
 * `externalUrl` for affiliate products whose photo stays on Mercado Libre.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 200 },
  ui: {
    listView: { initialColumns: ["product", "image", "order"] },
  },
  hooks: {
    validateInput: ({ operation, resolvedData, item, addValidationError }: any) => {
      if (operation === "delete") return;
      const externalUrl = resolvedData.externalUrl !== undefined ? resolvedData.externalUrl : item?.externalUrl;
      if (externalUrl && !isHttpsUrl(externalUrl)) {
        addValidationError("La imagen externa debe ser un enlace https://.");
      }
      if (operation !== "create") return;
      const uploaded = resolvedData.image?.id ?? resolvedData.image_id;
      if (!uploaded && !externalUrl) addValidationError("Sube una imagen o pega su enlace.");
    },
    afterOperation: async () => {
      bumpStoreCatalogVersion();
    },
  },
  fields: {
    product: relationship({ ref: "StoreProduct.images", many: false }),
    image: image({ storage: "s3_store" }),
    externalUrl: text({ db: { isNullable: true } }),
    alt: text(),
    order: integer({
      defaultValue: 1,
      validation: { isRequired: true },
      ui: { description: "1 es la portada. 2, 3… el resto." },
    }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
