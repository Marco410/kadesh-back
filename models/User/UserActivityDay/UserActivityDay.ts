import { list } from "@keystone-6/core";
import {
  calendarDay,
  integer,
  relationship,
  text,
  timestamp,
} from "@keystone-6/core/fields";
import { userActivityDayAccess } from "./UserActivityDay.access";

/**
 * Una fila por persona y día (hora de CDMX) con el tiempo que tuvo el panel abierto y visible.
 * El front manda un latido cada 5 minutos; aquí solo se suma. Sirve para "visto por última vez",
 * usuarios activos (DAU/WAU/MAU) y minutos de uso, sin guardar una fila por latido.
 */
export default list({
  access: userActivityDayAccess,
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ["day", "user", "company", "minutes", "lastSeenAt"],
      initialSort: { field: "day", direction: "DESC" },
    },
  },
  fields: {
    key: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      ui: { description: "userId:YYYY-MM-DD (permite sumar sin duplicar el día)" },
    }),
    user: relationship({ ref: "User", many: false }),
    company: relationship({
      ref: "SaasCompany",
      many: false,
      ui: { description: "Empresa de la persona ese día" },
    }),
    day: calendarDay({
      isIndexed: true,
      validation: { isRequired: true },
      ui: { description: "Día en hora de CDMX" },
    }),
    minutes: integer({
      defaultValue: 0,
      ui: { description: "Minutos con el panel abierto y la pestaña visible" },
    }),
    firstSeenAt: timestamp({ db: { isNullable: true } }),
    lastSeenAt: timestamp({ db: { isNullable: true }, isIndexed: true }),
  },
});
