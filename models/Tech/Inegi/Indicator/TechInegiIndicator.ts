import { list } from "@keystone-6/core";
import {
  float,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { inegiCatalogAccess } from "../access";
import { INEGI_GEOGRAPHIC_LEVEL_OPTIONS } from "../constants";

export default list({
  access: inegiCatalogAccess,
  ui: {
    labelField: "indicatorName",
    listView: {
      initialColumns: [
        "indicatorName",
        "geographicLevel",
        "geographicCode",
        "period",
        "value",
      ],
    },
  },
  fields: {
    cacheKey: text({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: {
        description: "indicatorId:geographicCode:period",
      },
    }),
    indicatorId: text({
      validation: { isRequired: true },
      isIndexed: true,
    }),
    indicatorName: text({
      validation: { isRequired: true },
    }),
    geographicLevel: select({
      type: "string",
      options: [...INEGI_GEOGRAPHIC_LEVEL_OPTIONS],
      validation: { isRequired: true },
    }),
    geographicCode: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "00 nacional, 2 dígitos estado, 5 dígitos municipio" },
    }),
    period: text({
      validation: { isRequired: true },
      ui: { description: "TIME_PERIOD de BIE (p. ej. 2020)" },
    }),
    value: float({ db: { isNullable: true } }),
    unit: text(),
    fetchedAt: timestamp({
      defaultValue: { kind: "now" },
    }),
  },
});
