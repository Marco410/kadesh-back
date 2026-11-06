import { list } from "@keystone-6/core";
import { json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import type { ListAccessControl } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin, isSignedIn } from "../../../../utils/access/tenant";
import { editableAnimalFilter } from "../Animal.access";
import { ADOPTION_APPLICATION_STATUS, ADOPTION_APPLICATION_STATUS_OPTIONS } from "./constants";

type AccessArgs = { session?: unknown };
const signedIn = ({ session }: AccessArgs) => isSignedIn(session as any);
const adminOnly = ({ session }: AccessArgs) => isPlatformAdmin(session as any);

/** La ve quien la envió y quien atiende el animal (su autor o el equipo de su espacio). */
function involvedWhere({ session }: AccessArgs) {
  if (isPlatformAdmin(session as any)) return true;
  const userId = getSessionUserId(session as any);
  if (!userId) return false;
  return {
    OR: [{ applicant: { id: { equals: userId } } }, { animal: editableAnimalFilter(userId) }],
  };
}

const access: ListAccessControl<any> = {
  operation: { query: signedIn, create: adminOnly, update: adminOnly, delete: adminOnly },
  filter: { query: involvedWhere },
};

/**
 * Solicitud para adoptar un animal «En adopción». Se envía, revisa, retira y completa con las
 * mutaciones de `graphql/customs/mutations/pet/adoptionApplications.ts` (sudo); por API solo un
 * admin la escribe. Nombre, correo y teléfono se copian al enviarla: quien revisa no puede leer el
 * `User` de quien la envió, y quien la envía acepta compartirlos.
 */
export default list({
  access,
  ui: {
    listView: {
      initialColumns: ["animal", "applicantName", "status", "createdAt"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  fields: {
    animal: relationship({ ref: "Animal", many: false }),
    applicant: relationship({ ref: "User", many: false }),
    applicantName: text(),
    applicantEmail: text(),
    phone: text(),
    message: text({ ui: { displayMode: "textarea" } }),
    /**
     * Cuestionario: `housing`, `housingOwnership`, `petsAllowed`, `hasYard`, `hasChildren`,
     * `otherPets`, `hoursAlone`, `experience`, `commitSterilization`, `acceptsFollowUp`.
     */
    answers: json(),
    status: select({
      options: ADOPTION_APPLICATION_STATUS_OPTIONS,
      defaultValue: ADOPTION_APPLICATION_STATUS.SUBMITTED,
      validation: { isRequired: true },
    }),
    /** Mensaje de quien revisa al aprobar o rechazar. Lo ve quien envió la solicitud. */
    decisionNote: text({ ui: { displayMode: "textarea" } }),
    decidedBy: relationship({ ref: "User", many: false }),
    decidedAt: timestamp({ db: { isNullable: true } }),
    /** La cartilla que recibió el adoptante al completarse. */
    pet: relationship({ ref: "Pet", many: false }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
    }),
    updatedAt: timestamp({
      defaultValue: { kind: "now" },
      db: { updatedAt: true },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
    }),
  },
});
