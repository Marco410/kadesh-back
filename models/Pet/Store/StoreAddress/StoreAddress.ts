import { list } from "@keystone-6/core";
import { checkbox, relationship, text, timestamp } from "@keystone-6/core/fields";
import { adminOnlyAccess } from "../../../../utils/access/presets";

/**
 * A shipping address a person saved. Read and written by `myStoreAddresses`, `saveStoreAddress`
 * and `deleteStoreAddress`. An order copies the address it ships to (`StoreOrder.ship*`), so
 * editing or deleting one here never changes an order.
 */
export default list({
  access: adminOnlyAccess,
  graphql: { maxTake: 100, omit: { create: true, update: true } },
  ui: {
    labelField: "label",
    listView: { initialColumns: ["user", "recipientName", "city", "stateCode", "postalCode"] },
  },
  fields: {
    user: relationship({ ref: "User", many: false }),
    label: text({ ui: { description: "Casa, Trabajo…" } }),
    recipientName: text({ validation: { isRequired: true } }),
    phone: text({ ui: { description: "10 dígitos." } }),
    street: text({ validation: { isRequired: true } }),
    exteriorNumber: text(),
    interiorNumber: text(),
    neighborhood: text({ ui: { description: "Colonia." } }),
    city: text({ ui: { description: "Municipio o alcaldía." } }),
    stateCode: text({ ui: { description: "Clave INEGI de dos dígitos (16 = Michoacán)." } }),
    postalCode: text({ ui: { description: "5 dígitos." } }),
    references: text({ ui: { displayMode: "textarea" } }),
    isDefault: checkbox({ defaultValue: false }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
