import { list } from "@keystone-6/core";
import { checkbox, image, relationship, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";
import { bumpStoreCatalogVersion } from "../../../../utils/store/config";
import { resolveStoreSlug } from "../../../../utils/store/slug";

/** Product brand. Shoppers read it through `storeCatalogFacets`; the generated API is admin only. */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 200 },
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "slug", "isActive"] },
  },
  hooks: {
    resolveInput: async ({ resolvedData, item, operation, context }: any) => {
      const data = { ...resolvedData };
      const slug = await resolveStoreSlug(context, "storeBrand", { operation, resolvedData: data, item });
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
    logo: image({ storage: "s3_store" }),
    isActive: checkbox({ defaultValue: true }),
    products: relationship({ ref: "StoreProduct.brand", many: true }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
