import type { ListAccessControl } from "@keystone-6/core/types";
import { getSessionUserId, isSignedIn } from "../../utils/access/tenant";

const signedIn = ({ session }: { session?: unknown }) => isSignedIn(session as any);

/** Cada quien solo ve, marca y borra las suyas; nadie las crea por API (solo `notify`, con sudo). */
function ownWhere({ session }: { session?: unknown }) {
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return { recipient: { id: { equals: userId } } };
}

export const notificationAccess: ListAccessControl<any> = {
  operation: {
    query: signedIn,
    create: () => false,
    update: signedIn,
    delete: signedIn,
  },
  filter: {
    query: ownWhere,
    update: ownWhere,
    delete: ownWhere,
  },
};

/** Por API solo se cambia `readAt` (marcar como leída / no leída). */
export const readOnlyField = {
  read: () => true,
  create: () => false,
  update: () => false,
};
