import { list } from "@keystone-6/core";
import { relationship, text } from "@keystone-6/core/fields";
import { inegiCatalogAccess } from "../access";

export default list({
  access: inegiCatalogAccess,
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["scianCode", "name"],
    },
  },
  fields: {
    scianCode: text({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: { description: "Código SCIAN (o clave sintética si la API no lo trae)" },
    }),
    name: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Nombre de la clase de actividad económica" },
    }),
    establishments: relationship({
      ref: "TechInegiEstablishment.economicActivity",
      many: true,
      ui: { hideCreate: true },
    }),
  },
});
