import { list } from "@keystone-6/core";
import { image, integer, relationship, timestamp } from "@keystone-6/core/fields";
import { isPlatformAdmin } from "../../../../utils/access/tenant";
import { isSudoContext } from "../../../../utils/activity/listActivityHooks";
import { petEventMultimediaAccess, validatePetEventMultimedia } from "../PetEvent.access";
import { PET_EVENT_STATUS } from "../constants";

/**
 * Fotos de un evento (`order` 1 = portada). Las sube quien organiza con `createPetEventMultimedia`
 * (upload de Keystone). Cambiar las fotos de un evento publicado lo regresa a revisión.
 */
export default list({
  access: petEventMultimediaAccess,
  hooks: {
    validateInput: validatePetEventMultimedia as any,
    // Una foto nueva o cambiada se revisa otra vez; quitar una no.
    afterOperation: async ({ operation, item, context }: any) => {
      if (operation === "delete" || isSudoContext(context) || isPlatformAdmin(context.session)) return;
      const eventId = item?.eventId;
      if (!eventId) return;
      try {
        const prisma = (context.sudo() as any).prisma;
        await prisma.petEvent.updateMany({
          where: { id: eventId, status: PET_EVENT_STATUS.APPROVED },
          data: { status: PET_EVENT_STATUS.PENDING },
        });
      } catch (error) {
        console.error("[pet-event] No se pudo regresar a revisión tras cambiar fotos:", eventId, error);
      }
    },
  },
  fields: {
    image: image({ storage: "s3_events" }),
    event: relationship({ ref: "PetEvent.multimedia" }),
    order: integer({
      defaultValue: 1,
      validation: { isRequired: true },
      ui: { description: "1 es la portada. 2, 3… el resto." },
    }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
