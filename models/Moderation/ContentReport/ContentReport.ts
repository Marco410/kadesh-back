import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { isPlatformAdmin } from "../../../utils/access/tenant";
import { REPORT_REASON_OPTIONS, REPORT_STATUS, REPORT_STATUS_OPTIONS, REPORTABLE_OPTIONS } from "../constants";

const adminOnly = ({ session }: { session?: unknown }) => isPlatformAdmin(session as any);

/**
 * Reporte de contenido generado por usuarios (comentarios, reportes de animales, personas). Lo
 * crea la app con `reportContent`; lo revisa Operaciones (las tiendas piden atenderlo en 24 h).
 */
export default list({
  access: {
    operation: { query: adminOnly, create: () => false, update: adminOnly, delete: adminOnly },
  },
  ui: {
    listView: {
      initialColumns: ["entityType", "reason", "status", "reportedUser", "createdAt"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  fields: {
    reporter: relationship({ ref: "User", many: false, ui: { description: "Quién reportó" } }),
    reportedUser: relationship({ ref: "User", many: false, ui: { description: "Autor del contenido reportado" } }),
    entityType: select({ type: "string", options: REPORTABLE_OPTIONS, validation: { isRequired: true } }),
    entityId: text({ isIndexed: true, validation: { isRequired: true } }),
    /** Copia del texto reportado al momento del reporte (por si después lo borran). */
    excerpt: text({ ui: { displayMode: "textarea" } }),
    reason: select({ type: "string", options: REPORT_REASON_OPTIONS, validation: { isRequired: true } }),
    details: text({ ui: { displayMode: "textarea" } }),
    status: select({ type: "string", options: REPORT_STATUS_OPTIONS, defaultValue: REPORT_STATUS.OPEN, isIndexed: true }),
    resolutionNote: text({ ui: { displayMode: "textarea", description: "Qué se hizo (interno)" } }),
    createdAt: timestamp({ defaultValue: { kind: "now" }, isIndexed: true }),
  },
});
