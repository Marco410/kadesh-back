import type { ListAccessControl } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin, isSignedIn } from "../../../../utils/access/tenant";
import { editableAnimalFilter } from "../Animal.access";

const signedIn = ({ session }: { session?: unknown }) => isSignedIn(session as any);
const adminOnly = ({ session }: { session?: unknown }) => isPlatformAdmin(session as any);

/**
 * Ve la solicitud quien la hizo, quien atiende el reporte (su autor o el equipo de su espacio de
 * rescate), quien lo atendía antes y un admin.
 */
function involvedWhere({ session }: { session?: unknown }) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return {
    OR: [
      { claimant: { id: { equals: userId } } },
      { previousUser: { id: { equals: userId } } },
      { animal: editableAnimalFilter(userId) },
    ],
  };
}

/**
 * `AnimalClaim`: crear con sesión (a nombre propio, ver `AnimalClaim.hooks.ts`); aprobar,
 * rechazar o cancelar pasa por `resolveAnimalClaim` / `cancelAnimalClaim` (sudo), así que por
 * API solo un admin la edita o la borra.
 */
export const animalClaimAccess: ListAccessControl<any> = {
  operation: { query: signedIn, create: signedIn, update: adminOnly, delete: adminOnly },
  filter: { query: involvedWhere },
};

/** Campos que solo escriben un admin o las mutaciones. */
export const adminWriteOnly = {
  create: adminOnly,
  update: adminOnly,
};
