import { list } from "@keystone-6/core";
import { json, select, text } from "@keystone-6/core/fields";
import { inegiCatalogAccess } from "../access";
import { INEGI_GEO_BOUNDARY_LEVEL_OPTIONS } from "../constants";

export default list({
  access: inegiCatalogAccess,
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["level", "geoCode", "name", "parentCode"],
    },
  },
  fields: {
    cacheKey: text({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: { description: "level:geoCode" },
    }),
    level: select({
      type: "string",
      options: [...INEGI_GEO_BOUNDARY_LEVEL_OPTIONS],
      validation: { isRequired: true },
    }),
    geoCode: text({
      validation: { isRequired: true },
      isIndexed: true,
    }),
    name: text({
      validation: { isRequired: true },
      isIndexed: true,
    }),
    parentCode: text({
      db: { isNullable: true },
      ui: { description: "CVE_ENT para municipio; CVEGEO municipal para localidad" },
    }),
    geometry: json({
      ui: { description: "GeoJSON geometry (sin PostGIS)" },
    }),
  },
});
