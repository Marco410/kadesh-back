import { list } from "@keystone-6/core";
import { calendarDay, integer, relationship, text, timestamp } from "@keystone-6/core/fields";
import { saasCompanyDailyUsageAccess } from "./SaasCompanyDailyUsage.access";

const count = (description: string) =>
  integer({ defaultValue: 0, validation: { isRequired: true }, ui: { description } });

/**
 * Una fila por empresa y día (hora de CDMX) con lo que hicieron. La arma `rollupDailyUsage`
 * (cron diario) a partir de los logs, para graficar tendencias y comparar contra otras empresas
 * del mismo plan sin recalcular todo cada vez. Días sin actividad no tienen fila.
 */
export default list({
  access: saasCompanyDailyUsageAccess,
  ui: {
    hideCreate: true,
    listView: {
      initialColumns: ["day", "company", "activeUsers", "activeMinutes", "extractions", "crmChanges"],
      initialSort: { field: "day", direction: "DESC" },
    },
  },
  fields: {
    key: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      ui: { description: "companyId:YYYY-MM-DD" },
    }),
    company: relationship({ ref: "SaasCompany", many: false }),
    day: calendarDay({ isIndexed: true, validation: { isRequired: true } }),
    activeUsers: count("Personas con el panel abierto"),
    activeMinutes: count("Minutos con el panel abierto (todo el equipo)"),
    logins: count("Inicios de sesión correctos"),
    extractions: count("Extracciones"),
    extractionsFailed: count("Extracciones con error"),
    leadsCreated: count("Leads nuevos de extracciones"),
    leadsReused: count("Leads que salieron de la base"),
    creditsConsumed: count("Créditos gastados (extracción + IA)"),
    aiCalls: count("Llamadas a IA"),
    crmChanges: count("Cambios registrados en CRM y equipo (ActivityEvent)"),
    activitiesLogged: count("Actividades registradas (llamadas, reuniones…)"),
    quotationsCreated: count("Cotizaciones creadas"),
    quotationsSent: count("Cotizaciones enviadas"),
    quotationsAccepted: count("Cotizaciones aceptadas"),
    whatsappSent: count("WhatsApp enviados"),
    whatsappReceived: count("WhatsApp recibidos"),
    computedAt: timestamp({ db: { isNullable: true }, ui: { description: "Cuándo se calculó" } }),
  },
});
