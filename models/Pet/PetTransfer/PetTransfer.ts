import { graphql, list } from "@keystone-6/core";
import { relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";
import type { ListAccessControl } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin, isSignedIn } from "../../../utils/access/tenant";
import { ownedPetFilter } from "../Pet.access";
import { rescueOrgMemberFilter } from "../RescueOrganization/RescueOrganization.access";
import { RESCUE_ANIMAL_MANAGER_ROLES } from "../RescueOrganization/constants";
import { PET_TRANSFER_STATUS, PET_TRANSFER_STATUS_OPTIONS } from "./constants";

type AccessArgs = { session?: unknown };
const signedIn = ({ session }: AccessArgs) => isSignedIn(session as any);
const adminOnly = ({ session }: AccessArgs) => isPlatformAdmin(session as any);

/**
 * Los códigos solo los ve quien puede dar la mascota: quien lo generó, el dueño principal actual o
 * admin/coordinación del espacio que lo generó. Quien lo recibe nunca lee esta list: escribe el
 * código en `previewPetTransferCode` / `redeemPetTransferCode` (sudo).
 */
function giverWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return {
    OR: [
      { createdBy: { id: { equals: userId } } },
      { pet: ownedPetFilter(userId, true) },
      { fromOrganization: rescueOrgMemberFilter(userId, RESCUE_ANIMAL_MANAGER_ROLES) },
    ],
  };
}

const access: ListAccessControl<any> = {
  operation: { query: signedIn, create: adminOnly, update: adminOnly, delete: adminOnly },
  filter: { query: giverWhere },
};

/**
 * Código para traspasar una mascota (con su cartilla) a otra cuenta. Se crea, cancela y canjea con
 * las mutaciones de `graphql/customs/mutations/pet/card/petTransfer.ts`; por API solo lo escribe un
 * admin.
 */
export default list({
  access,
  ui: {
    listView: {
      initialColumns: ["code", "pet", "status", "expiresAt", "createdAt"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  fields: {
    pet: relationship({ ref: "Pet", many: false }),
    code: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      ui: { description: "«7KQ2-M9XA». Se guarda sin guion y en mayúsculas." },
    }),
    status: select({
      options: PET_TRANSFER_STATUS_OPTIONS,
      defaultValue: PET_TRANSFER_STATUS.PENDING,
      validation: { isRequired: true },
    }),
    expiresAt: timestamp({ validation: { isRequired: true } }),
    /** Mensaje opcional de quien da la mascota («Le encanta el parque…»). Lo ve quien la recibe. */
    message: text({ ui: { displayMode: "textarea" } }),
    /** Si era ficha de un espacio de rescate al generar el código. */
    fromOrganization: relationship({ ref: "RescueOrganization", many: false }),
    createdBy: relationship({ ref: "User", many: false }),
    redeemedBy: relationship({ ref: "User", many: false }),
    redeemedAt: timestamp({ db: { isNullable: true } }),
    /** Vencido: sigue `pending` pero ya pasó `expiresAt`. */
    isExpired: virtual({
      field: graphql.field({
        type: graphql.Boolean,
        resolve(item: any) {
          return (
            item?.status === PET_TRANSFER_STATUS.PENDING &&
            Boolean(item?.expiresAt) &&
            new Date(item.expiresAt).getTime() < Date.now()
          );
        },
      }),
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
    }),
  },
});
