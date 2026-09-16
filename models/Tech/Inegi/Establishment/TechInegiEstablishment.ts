import { list } from "@keystone-6/core";
import {
  float,
  json,
  relationship,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { inegiCatalogAccess } from "../access";

export default list({
  access: inegiCatalogAccess,
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["clee", "name", "municipality", "state", "lastSyncedAt"],
    },
  },
  fields: {
    clee: text({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: { description: "Clave única INEGI (CLEE)" },
    }),
    name: text({
      validation: { isRequired: true },
      isIndexed: true,
    }),
    legalName: text({
      ui: { description: "Razón social" },
    }),
    employeeStratum: text({
      ui: { description: "Estrato de personal ocupado (tal cual DENUE)" },
    }),
    economicActivity: relationship({
      ref: "TechInegiEconomicActivity.establishments",
      many: false,
      ui: { description: "Giro SCIAN" },
    }),
    street: text(),
    exteriorNumber: text(),
    interiorNumber: text(),
    neighborhood: text(),
    postalCode: text(),
    locality: text(),
    municipality: text({ isIndexed: true }),
    state: text({ isIndexed: true }),
    phone: text(),
    email: text(),
    website: text(),
    lat: float({ db: { isNullable: true } }),
    lng: float({ db: { isNullable: true } }),
    rawPayload: json({
      ui: { description: "Respuesta cruda de INEGI (API o fila CSV)" },
    }),
    lastSyncedAt: timestamp({
      db: { isNullable: true },
      ui: { description: "Última vez que se actualizó desde INEGI" },
    }),
    promotedLeads: relationship({
      ref: "TechBusinessLead.sourceEstablishment",
      many: true,
      ui: { hideCreate: true, description: "Leads CRM promovidos desde este establecimiento" },
    }),
  },
});
