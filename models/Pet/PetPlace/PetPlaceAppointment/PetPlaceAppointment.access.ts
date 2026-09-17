import { ListAccessControl } from "@keystone-6/core/types";
import {
  getSessionUserId,
  isPlatformAdmin,
  isSignedIn,
} from "../../../../utils/access/tenant";

/**
 * Filas visibles/editables:
 *  - admin de plataforma: todas
 *  - dueño verificado del pet_place: las de su(s) negocio(s)
 *  - cliente: solo las que él mismo reservó
 */
function visibleWhere(session: any): true | false | Record<string, unknown> {
  if (isPlatformAdmin(session)) return true;

  const userId = getSessionUserId(session);
  if (!userId) return false;

  return {
    OR: [
      { customer: { id: { equals: userId } } },
      {
        pet_place: {
          user: { id: { equals: userId } },
          verified: { equals: true },
        },
      },
    ],
  };
}

export const petPlaceAppointmentAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session) || isPlatformAdmin(session),
    create: ({ session }: any) => isSignedIn(session),
    update: ({ session }: any) => isSignedIn(session),
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
  filter: {
    query: ({ session }: any) => visibleWhere(session),
    update: ({ session }: any) => visibleWhere(session),
  },
};

export default petPlaceAppointmentAccess;
