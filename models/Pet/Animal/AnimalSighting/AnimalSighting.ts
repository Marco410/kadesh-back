import { list } from "@keystone-6/core";
import { checkbox, relationship, text, timestamp } from "@keystone-6/core/fields";
import { isPlatformAdmin } from "../../../../utils/access/tenant";

const adminOnly = ({ session }: { session?: unknown }) => isPlatformAdmin(session as any);

/**
 * «Lo vi»: aviso de que alguien vio a un animal reportado (perdido o abandonado). Lo puede mandar
 * cualquiera, con o sin cuenta, y sale al momento en la ficha.
 *
 * Por API solo lo toca un admin (Operaciones / admin UI). Crear va por `reportAnimalSighting` y
 * ocultar por `setAnimalSightingHidden` (sudo). La ficha lo lee con el campo virtual
 * `Animal.sightings`, que solo le da el contacto a quien atiende el reporte.
 */
export default list({
  access: {
    operation: { query: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  },
  ui: {
    listView: { initialColumns: ["animal", "seenAt", "placeLabel", "hidden", "createdAt"] },
  },
  fields: {
    animal: relationship({ ref: "Animal", many: false }),
    /** Si quien avisó tenía sesión. */
    user: relationship({ ref: "User", many: false }),
    seenAt: timestamp({ validation: { isRequired: true } }),
    lat: text({ validation: { isRequired: true } }),
    lng: text({ validation: { isRequired: true } }),
    /** Lo que resolvió el mapa (calle, colonia). */
    placeLabel: text(),
    city: text(),
    state: text(),
    notes: text({ ui: { displayMode: "textarea" } }),
    /** Opcional, para que la familia le pueda escribir. Solo lo ve quien atiende el reporte. */
    contactName: text(),
    contactPhone: text(),
    /** Quien atiende el reporte (o un admin) lo ocultó: ya no sale en la ficha pública. */
    hidden: checkbox({ defaultValue: false }),
    /** Para frenar abuso y revisar en Operaciones. No sale en la ficha. */
    ip: text({ ui: { itemView: { fieldMode: "read" } } }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
