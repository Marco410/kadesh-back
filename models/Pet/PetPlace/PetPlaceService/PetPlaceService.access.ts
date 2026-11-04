import type { ListAccessControl } from "@keystone-6/core/types";
import { adminOnly, anyone } from "../../../../utils/access/presets";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { PET_PLACE_SERVICE_STATUS } from "./status";

/**
 * Catálogo de servicios de veterinarias. El público solo ve los aprobados; quien tiene sesión ve
 * además los que pidió o los que pidió su clínica (para mostrarle "pendiente"); el admin ve todos.
 * Crear, aprobar y rechazar es del admin; el dueño pide servicios con `requestPetPlaceService`
 * (sudo).
 */
export const petPlaceServiceAccess: ListAccessControl<any> = {
  operation: { query: anyone, create: adminOnly, update: adminOnly, delete: adminOnly },
  filter: {
    query: ({ session }: { session?: unknown }) => {
      if (isPlatformAdmin(session as any)) return true;
      const approved = { status: { equals: PET_PLACE_SERVICE_STATUS.APPROVED } };
      const userId = getSessionUserId(session as any);
      if (!userId) return approved;
      return {
        OR: [
          approved,
          { requestedBy: { id: { equals: userId } } },
          { requestedFor: { user: { id: { equals: userId } } } },
        ],
      };
    },
  },
};
