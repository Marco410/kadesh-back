import { list } from "@keystone-6/core";
import { checkbox, image, integer, relationship, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";
import { bumpStoreCatalogVersion } from "../../../../utils/store/config";
import { resolveStoreSlug } from "../../../../utils/store/slug";

/**
 * Store category, up to two levels (`parent`). Shoppers read it through `storeCatalogFacets`; the
 * generated API is admin only.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 200 },
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "slug", "parent", "order", "isActive"] },
  },
  hooks: {
    resolveInput: async ({ resolvedData, item, operation, context }: any) => {
      const data = { ...resolvedData };
      const slug = await resolveStoreSlug(context, "storeCategory", { operation, resolvedData: data, item });
      if (slug !== undefined) data.slug = slug;
      else delete data.slug;
      return data;
    },
    afterOperation: async () => {
      bumpStoreCatalogVersion();
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: { description: "Se genera del nombre si se deja vacío." },
    }),
    parent: relationship({ ref: "StoreCategory.children", many: false }),
    children: relationship({ ref: "StoreCategory.parent", many: true }),
    image: image({ storage: "s3_store" }),
    order: integer({ defaultValue: 0, validation: { isRequired: true } }),
    isActive: checkbox({ defaultValue: true }),
    products: relationship({ ref: "StoreProduct.category", many: true }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
