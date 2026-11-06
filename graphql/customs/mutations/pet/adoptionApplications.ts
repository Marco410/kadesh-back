import { GraphQLError } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../../../models/Notification/constants";
import { canEditAnimalAs } from "../../../../models/Pet/Animal/Animal.access";
import {
  ADOPTION_APPLICATION_ACTIVE_STATUSES,
  ADOPTION_APPLICATION_LIMITS,
  ADOPTION_APPLICATION_REVIEW_STATUSES,
  ADOPTION_APPLICATION_STATUS,
  ADOPTION_HOUSING_OPTIONS,
  ADOPTION_HOUSING_OWNERSHIP_OPTIONS,
} from "../../../../models/Pet/Animal/AdoptionApplication/constants";
import { PET_OWNER_ROLE } from "../../../../models/Pet/constants";
import { findPetOwnerRole } from "../../../../models/Pet/Pet.access";
import { findRescueMemberRole } from "../../../../models/Pet/RescueOrganization/RescueOrganization.access";
import { RESCUE_ANIMAL_MANAGER_ROLES } from "../../../../models/Pet/RescueOrganization/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";
import { reportAudienceWithTeam } from "../../../../utils/notifications/animalReportAlerts";
import { notify } from "../../../../utils/notifications/notify";
import { settleApplicationsAfterAdoption } from "../../../../utils/pet/adoptionApplications";
import { petPublicUrl } from "../../../../utils/pet/animalReport";
import { adoptionApplicationUrl, petCardUrl } from "../../../../utils/pet/petCard";
import {
  REPORT_FOR_PET_QUERY,
  cancelPendingTransfers,
  createPetFromReport,
  loadTransferablePet,
  transferPetToOwner,
  type ReportForPet,
} from "../../../../utils/pet/petTransfer";
import { normalizeMxPhone } from "../../../../utils/pet/phone";
import { closeReportAsAdopted, lastReportLog } from "../../../../utils/pet/reportLogs";

/**
 * Solicitudes de adopción («Quiero adoptarlo»). Ver models/Pet/RescueOrganization/README.md
 * («Solicitudes de adopción»).
 *
 * - `submitAdoptionApplication`: cualquier persona con sesión, para un animal «En adopción» que no
 *   publicó ella. Una abierta por animal. Avisa a quien lo publicó y a admin/coordinación del espacio.
 * - `reviewAdoptionApplication`: quien atiende el animal (autor o equipo del espacio) la pone en
 *   revisión, la aprueba o la rechaza. Avisa a quien la envió.
 * - `editAdoptionApplication`: quien la envió la corrige mientras siga «Enviada» (nadie la ha
 *   puesto en revisión ni decidido). Avisa a quien atiende el animal que la actualizó.
 * - `withdrawAdoptionApplication`: quien la envió la retira.
 * - `completeAdoptionApplication`: con la solicitud aprobada, el animal pasa a la cuenta del
 *   adoptante con su cartilla (si no tenía, se crea desde el reporte) y el reporte queda
 *   «Adoptado». Las demás solicitudes se cierran. En un espacio la completan admin y coordinación;
 *   si no, quien publicó el reporte.
 */

const typeDefs = `
  input AdoptionApplicationInput {
    phone: String!
    "Por qué quiere adoptarlo (20 a 1000 caracteres)"
    message: String!
    "house | apartment | other"
    housing: String!
    "own | rent | family"
    housingOwnership: String!
    "Si renta: ¿le permiten tener mascotas?"
    petsAllowed: Boolean
    hasYard: Boolean!
    hasChildren: Boolean!
    otherPets: String
    "Horas al día que estaría solo (0 a 24)"
    hoursAlone: Int!
    experience: String
    commitSterilization: Boolean!
    acceptsFollowUp: Boolean!
  }

  type AdoptionApplicationResult {
    success: Boolean!
    message: String!
    application: AdoptionApplication
  }

  type CompleteAdoptionApplicationResult {
    success: Boolean!
    message: String!
    petId: ID
  }
`;

const definition = `
  submitAdoptionApplication(animalId: ID!, input: AdoptionApplicationInput!): AdoptionApplicationResult!
  "Solo quien la envió y solo mientras siga «Enviada» (submitted)."
  editAdoptionApplication(applicationId: ID!, input: AdoptionApplicationInput!): AdoptionApplicationResult!
  "status: in_review | approved | rejected"
  reviewAdoptionApplication(applicationId: ID!, status: String!, note: String): AdoptionApplicationResult!
  withdrawAdoptionApplication(applicationId: ID!): AdoptionApplicationResult!
  completeAdoptionApplication(applicationId: ID!): CompleteAdoptionApplicationResult!
`;

type ApplicationInput = {
  phone: string;
  message: string;
  housing: string;
  housingOwnership: string;
  petsAllowed?: boolean | null;
  hasYard: boolean;
  hasChildren: boolean;
  otherPets?: string | null;
  hoursAlone: number;
  experience?: string | null;
  commitSterilization: boolean;
  acceptsFollowUp: boolean;
};

type AnimalRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  user?: { id: string } | null;
  organization?: { id: string; name: string } | null;
  duplicateOf?: { id: string } | null;
};

type ApplicationRow = {
  id: string;
  status: string;
  applicantName?: string | null;
  applicant?: { id: string } | null;
  animal?: AnimalRow | null;
};

const ANIMAL_FIELDS = "id name slug user { id } organization { id name } duplicateOf { id }";
const HOUSING_VALUES = new Set(ADOPTION_HOUSING_OPTIONS.map((option) => option.value));
const OWNERSHIP_VALUES = new Set(ADOPTION_HOUSING_OWNERSHIP_OPTIONS.map((option) => option.value));

function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof GraphQLError ? error.message : fallback;
}

function animalLabel(animal: { name?: string | null } | null | undefined): string {
  return animal?.name?.trim() || "este animal";
}

function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || "Alguien";
}

function animalUrl(animal: AnimalRow, applicationId?: string): string {
  const base = petPublicUrl(animal.slug || animal.id);
  return applicationId ? `${base}?solicitud=${encodeURIComponent(applicationId)}` : base;
}

async function loadApplication(context: KeystoneContext, applicationId: string): Promise<ApplicationRow> {
  const application = (await context.sudo().query.AdoptionApplication.findOne({
    where: { id: applicationId },
    query: `id status applicantName applicant { id } animal { ${ANIMAL_FIELDS} }`,
  })) as ApplicationRow | null;
  if (!application?.animal) throw new GraphQLError("No encontramos esa solicitud.");
  return application;
}

/** Revisan: quien puede editar el animal (autor o equipo del espacio) y un admin de plataforma. */
async function canReview(context: KeystoneContext, animal: AnimalRow, userId: string): Promise<boolean> {
  if (isPlatformAdmin(context.session)) return true;
  return canEditAnimalAs(
    context,
    { userId: animal.user?.id ?? null, organizationId: animal.organization?.id ?? null },
    userId,
  );
}

/** Completan (entregan al animal): admin/coordinación si es de un espacio; si no, su autor. */
async function canComplete(context: KeystoneContext, animal: AnimalRow, userId: string): Promise<boolean> {
  if (isPlatformAdmin(context.session)) return true;
  if (animal.organization) {
    const role = await findRescueMemberRole(context, animal.organization.id, userId);
    return Boolean(role && RESCUE_ANIMAL_MANAGER_ROLES.includes(role));
  }
  return animal.user?.id === userId;
}

function validateInput(input: ApplicationInput): { ok: true; phone: string } | { ok: false; message: string } {
  const phone = normalizeMxPhone(input.phone ?? "");
  if (!phone.ok) return { ok: false, message: phone.reason };
  const message = (input.message ?? "").trim();
  if (message.length < ADOPTION_APPLICATION_LIMITS.MESSAGE_MIN) {
    return { ok: false, message: "Cuéntanos un poco más por qué quieres adoptarlo." };
  }
  if (message.length > ADOPTION_APPLICATION_LIMITS.MESSAGE_MAX) {
    return { ok: false, message: `El mensaje puede tener hasta ${ADOPTION_APPLICATION_LIMITS.MESSAGE_MAX} caracteres.` };
  }
  if (!HOUSING_VALUES.has(input.housing)) return { ok: false, message: "Elige en qué tipo de vivienda vives." };
  if (!OWNERSHIP_VALUES.has(input.housingOwnership)) return { ok: false, message: "Elige si tu vivienda es propia o rentada." };
  const hours = Number(input.hoursAlone);
  if (!Number.isInteger(hours) || hours < 0 || hours > ADOPTION_APPLICATION_LIMITS.HOURS_ALONE_MAX) {
    return { ok: false, message: "Escribe cuántas horas al día estaría solo (0 a 24)." };
  }
  for (const text of [input.otherPets, input.experience]) {
    if ((text ?? "").trim().length > ADOPTION_APPLICATION_LIMITS.TEXT_MAX) {
      return { ok: false, message: `Cada respuesta puede tener hasta ${ADOPTION_APPLICATION_LIMITS.TEXT_MAX} caracteres.` };
    }
  }
  if (!input.commitSterilization || !input.acceptsFollowUp) {
    return { ok: false, message: "Para adoptar hay que comprometerse a esterilizarlo y aceptar el seguimiento." };
  }
  return { ok: true, phone: phone.digits };
}

/** El JSON `answers` tal como se guarda (al enviar y al editar). */
function answersFrom(input: ApplicationInput) {
  return {
    housing: input.housing,
    housingOwnership: input.housingOwnership,
    petsAllowed: input.housingOwnership === "rent" ? Boolean(input.petsAllowed) : null,
    hasYard: Boolean(input.hasYard),
    hasChildren: Boolean(input.hasChildren),
    otherPets: (input.otherPets ?? "").trim(),
    hoursAlone: Number(input.hoursAlone),
    experience: (input.experience ?? "").trim(),
    commitSterilization: true,
    acceptsFollowUp: true,
  };
}

const REVIEW_COPY: Record<string, (name: string, note: string) => { title: string; body: string }> = {
  [ADOPTION_APPLICATION_STATUS.IN_REVIEW]: (name) => ({
    title: `Tu solicitud para adoptar a ${name} está en revisión`,
    body: "Quien lo cuida la está revisando. Puede que te contacten por teléfono.",
  }),
  [ADOPTION_APPLICATION_STATUS.APPROVED]: (name, note) => ({
    title: `¡Aprobaron tu solicitud para adoptar a ${name}!`,
    body: note || "Te contactarán para coordinar la entrega.",
  }),
  [ADOPTION_APPLICATION_STATUS.REJECTED]: (name, note) => ({
    title: `Tu solicitud para adoptar a ${name} no fue aprobada`,
    body: note || "Gracias por querer adoptar. Hay más animales esperando un hogar en KADESH.",
  }),
};

const resolver = {
  submitAdoptionApplication: async (
    _root: unknown,
    { animalId, input }: { animalId: string; input: ApplicationInput },
    context: KeystoneContext,
  ) => {
    const fail = (message: string) => ({ success: false, message, application: null });
    try {
      const userId = getSessionUserId(context.session);
      if (!userId) return fail("Inicia sesión para enviar tu solicitud.");
      const sudo = context.sudo();
      const animal = (await sudo.query.Animal.findOne({ where: { id: animalId }, query: ANIMAL_FIELDS })) as AnimalRow | null;
      if (!animal) return fail("No encontramos ese animal.");
      if (animal.duplicateOf) return fail("Este reporte se unió a otro: solicita desde el reporte principal.");
      const last = await lastReportLog(context, animal.id);
      if (last?.status !== "in_adoption") return fail(`${animalLabel(animal)} ya no está en adopción.`);
      if (await canReview(context, animal, userId)) return fail("Es un animal que tú (o tu equipo) publicaste.");

      const open = await sudo.query.AdoptionApplication.count({
        where: {
          animal: { id: { equals: animal.id } },
          applicant: { id: { equals: userId } },
          status: { in: ADOPTION_APPLICATION_ACTIVE_STATUSES },
        },
      });
      if (open > 0) return fail(`Ya enviaste una solicitud para ${animalLabel(animal)}. Te avisaremos cuando respondan.`);

      const checked = validateInput(input);
      if (!checked.ok) return fail(checked.message);
      const applicant = (await sudo.query.User.findOne({
        where: { id: userId },
        query: "name lastName email",
      })) as { name?: string | null; lastName?: string | null; email?: string | null } | null;
      const applicantName = [applicant?.name, applicant?.lastName].filter(Boolean).join(" ").trim();

      const created = (await sudo.query.AdoptionApplication.createOne({
        data: {
          animal: { connect: { id: animal.id } },
          applicant: { connect: { id: userId } },
          applicantName,
          applicantEmail: applicant?.email ?? "",
          phone: checked.phone,
          message: input.message.trim(),
          answers: answersFrom(input),
          status: ADOPTION_APPLICATION_STATUS.SUBMITTED,
        },
        query: "id",
      })) as { id: string };

      const name = animalLabel(animal);
      void notify(context, {
        audience: await reportAudienceWithTeam(context, animal),
        product: "pet",
        type: NOTIFICATION_TYPE.ADOPTION_APPLICATION_RECEIVED,
        title: `${firstName(applicantName)} quiere adoptar a ${name}`,
        body: input.message.trim().replace(/\s+/g, " ").slice(0, 140),
        entityType: "AdoptionApplication",
        entityId: created.id,
        url: animalUrl(animal, created.id),
        metadata: { animalId: animal.id, organizationId: animal.organization?.id ?? null },
      });
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_ADOPTION_APPLICATION_SUBMITTED,
        summary: `Pidió adoptar a "${name.slice(0, 60)}"`,
        entityType: "AdoptionApplication",
        entityId: created.id,
        metadata: { animalId: animal.id, organizationId: animal.organization?.id ?? null },
      });
      return {
        success: true,
        message: `Enviamos tu solicitud para adoptar a ${name}. Te avisaremos cuando la revisen.`,
        application: await context.db.AdoptionApplication.findOne({ where: { id: created.id } }),
      };
    } catch (error) {
      console.error("[submitAdoptionApplication]", error);
      return fail(errorMessage(error, "No pudimos enviar tu solicitud. Intenta de nuevo."));
    }
  },

  reviewAdoptionApplication: async (
    _root: unknown,
    { applicationId, status, note }: { applicationId: string; status: string; note?: string | null },
    context: KeystoneContext,
  ) => {
    const fail = (message: string) => ({ success: false, message, application: null });
    try {
      const userId = getSessionUserId(context.session);
      if (!userId) return fail("Inicia sesión para continuar.");
      if (!ADOPTION_APPLICATION_REVIEW_STATUSES.includes(status)) return fail("Elige qué hacer con la solicitud.");
      const application = await loadApplication(context, applicationId);
      const animal = application.animal!;
      if (!(await canReview(context, animal, userId))) return fail("Solo quien atiende a este animal revisa sus solicitudes.");
      if (!ADOPTION_APPLICATION_ACTIVE_STATUSES.includes(application.status)) return fail("Esta solicitud ya está cerrada.");
      if (application.status === status) return fail("La solicitud ya está así.");
      const clean = (note ?? "").trim();
      if (clean.length > ADOPTION_APPLICATION_LIMITS.NOTE_MAX) {
        return fail(`El mensaje puede tener hasta ${ADOPTION_APPLICATION_LIMITS.NOTE_MAX} caracteres.`);
      }

      const updated = await prismaOf(context).adoptionApplication.update({
        where: { id: application.id },
        data: {
          status,
          // `text` de Keystone: cadena vacía, no null.
          decisionNote: status === ADOPTION_APPLICATION_STATUS.IN_REVIEW ? "" : clean,
          decidedById: userId,
          decidedAt: new Date(),
        },
      });
      if (updated instanceof Error) throw updated;

      const name = animalLabel(animal);
      if (application.applicant?.id) {
        const copy = REVIEW_COPY[status](name, clean);
        void notify(context, {
          audience: [application.applicant.id],
          product: "pet",
          type: NOTIFICATION_TYPE.ADOPTION_APPLICATION_UPDATED,
          title: copy.title,
          body: copy.body,
          entityType: "AdoptionApplication",
          entityId: application.id,
          url: adoptionApplicationUrl(application.id),
          metadata: { status },
        });
      }
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_ADOPTION_APPLICATION_REVIEWED,
        summary: `Marcó como ${status} la solicitud para adoptar a "${name.slice(0, 60)}"`,
        entityType: "AdoptionApplication",
        entityId: application.id,
        metadata: { status, animalId: animal.id },
      });
      return {
        success: true,
        message:
          status === ADOPTION_APPLICATION_STATUS.APPROVED
            ? "Solicitud aprobada. Cuando entreguen al animal, complétala para pasarle su cartilla."
            : status === ADOPTION_APPLICATION_STATUS.REJECTED
              ? "Solicitud no aprobada. Le avisamos con cuidado."
              : "Solicitud en revisión. Le avisamos.",
        application: await context.db.AdoptionApplication.findOne({ where: { id: application.id } }),
      };
    } catch (error) {
      console.error("[reviewAdoptionApplication]", error);
      return fail(errorMessage(error, "No pudimos actualizar la solicitud. Intenta de nuevo."));
    }
  },

  editAdoptionApplication: async (
    _root: unknown,
    { applicationId, input }: { applicationId: string; input: ApplicationInput },
    context: KeystoneContext,
  ) => {
    const fail = (message: string) => ({ success: false, message, application: null });
    try {
      const userId = getSessionUserId(context.session);
      const application = await loadApplication(context, applicationId);
      if (!userId || application.applicant?.id !== userId) return fail("Solo quien envió la solicitud puede editarla.");
      const animal = application.animal!;
      const name = animalLabel(animal);
      if (application.status !== ADOPTION_APPLICATION_STATUS.SUBMITTED) {
        return fail(
          ADOPTION_APPLICATION_ACTIVE_STATUSES.includes(application.status)
            ? `Quien cuida a ${name} ya la está revisando, así que ya no se puede editar. Si algo cambió, cuéntaselo cuando te contacte.`
            : "Esta solicitud ya está cerrada.",
        );
      }
      const checked = validateInput(input);
      if (!checked.ok) return fail(checked.message);

      const updated = await prismaOf(context).adoptionApplication.update({
        where: { id: application.id },
        data: { phone: checked.phone, message: input.message.trim(), answers: answersFrom(input) },
      });
      if (updated instanceof Error) throw updated;

      void notify(context, {
        audience: await reportAudienceWithTeam(context, animal),
        product: "pet",
        type: NOTIFICATION_TYPE.ADOPTION_APPLICATION_RECEIVED,
        title: `${firstName(application.applicantName)} actualizó su solicitud para adoptar a ${name}`,
        body: input.message.trim().replace(/\s+/g, " ").slice(0, 140),
        entityType: "AdoptionApplication",
        entityId: application.id,
        url: animalUrl(animal, application.id),
        metadata: { animalId: animal.id, organizationId: animal.organization?.id ?? null, edited: true },
      });
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_ADOPTION_APPLICATION_EDITED,
        summary: `Editó su solicitud para adoptar a "${name.slice(0, 60)}"`,
        entityType: "AdoptionApplication",
        entityId: application.id,
        metadata: { animalId: animal.id },
      });
      return {
        success: true,
        message: `Guardamos los cambios. Quien cuida a ${name} verá tu solicitud actualizada.`,
        application: await context.db.AdoptionApplication.findOne({ where: { id: application.id } }),
      };
    } catch (error) {
      console.error("[editAdoptionApplication]", error);
      return fail(errorMessage(error, "No pudimos guardar los cambios. Intenta de nuevo."));
    }
  },

  withdrawAdoptionApplication: async (
    _root: unknown,
    { applicationId }: { applicationId: string },
    context: KeystoneContext,
  ) => {
    const fail = (message: string) => ({ success: false, message, application: null });
    try {
      const userId = getSessionUserId(context.session);
      const application = await loadApplication(context, applicationId);
      if (!userId || application.applicant?.id !== userId) return fail("Solo quien envió la solicitud puede retirarla.");
      if (!ADOPTION_APPLICATION_ACTIVE_STATUSES.includes(application.status)) return fail("Esta solicitud ya está cerrada.");
      const updated = await prismaOf(context).adoptionApplication.update({
        where: { id: application.id },
        data: { status: ADOPTION_APPLICATION_STATUS.WITHDRAWN, decidedAt: new Date() },
      });
      if (updated instanceof Error) throw updated;
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_ADOPTION_APPLICATION_WITHDRAWN,
        summary: `Retiró su solicitud para adoptar a "${animalLabel(application.animal).slice(0, 60)}"`,
        entityType: "AdoptionApplication",
        entityId: application.id,
      });
      return {
        success: true,
        message: "Retiraste tu solicitud.",
        application: await context.db.AdoptionApplication.findOne({ where: { id: application.id } }),
      };
    } catch (error) {
      console.error("[withdrawAdoptionApplication]", error);
      return fail(errorMessage(error, "No pudimos retirar la solicitud. Intenta de nuevo."));
    }
  },

  completeAdoptionApplication: async (
    _root: unknown,
    { applicationId }: { applicationId: string },
    context: KeystoneContext,
  ) => {
    const fail = (message: string) => ({ success: false, message, petId: null });
    try {
      const userId = getSessionUserId(context.session);
      if (!userId) return fail("Inicia sesión para continuar.");
      const application = await loadApplication(context, applicationId);
      const animalRow = application.animal!;
      if (application.status !== ADOPTION_APPLICATION_STATUS.APPROVED) return fail("Primero aprueba la solicitud.");
      if (!(await canComplete(context, animalRow, userId))) {
        return fail(
          animalRow.organization
            ? "La adopción la completan admin y coordinación del espacio."
            : "La adopción la completa quien publicó al animal.",
        );
      }
      const adopterId = application.applicant?.id;
      if (!adopterId) return fail("La cuenta de quien pidió adoptarlo ya no existe.");

      const report = (await context.sudo().query.Animal.findOne({
        where: { id: animalRow.id },
        query: REPORT_FOR_PET_QUERY,
      })) as ReportForPet | null;
      if (!report) return fail("No encontramos ese animal.");
      const name = animalLabel(report);
      const giverName = report.organization?.name ?? null;
      const reportNote = giverName ? `Adoptado con ${giverName} en KADESH.` : "Adoptado con KADESH.";

      let petId: string;
      if (report.pet) {
        const pet = await loadTransferablePet(context, report.pet.id);
        if (!pet) return fail("No encontramos su cartilla.");
        if (pet.organizationId) {
          if (pet.organizationId !== report.organization?.id) return fail("Su ficha es de otro espacio de rescate.");
        } else if (!report.user?.id || (await findPetOwnerRole(context, pet.id, report.user.id)) !== PET_OWNER_ROLE.PRINCIPAL) {
          return fail("Este animal tiene la cartilla de otra persona: pídele que te la pase con un código.");
        }
        await transferPetToOwner(context, pet, adopterId);
        await cancelPendingTransfers(context, pet.id);
        petId = pet.id;
      } else {
        petId = await createPetFromReport(context, report, { ownerId: adopterId });
      }
      await closeReportAsAdopted(context, report.id, reportNote);
      await settleApplicationsAfterAdoption(context, { animal: report, adopterId, petId });

      void notify(context, {
        audience: [adopterId],
        product: "pet",
        type: NOTIFICATION_TYPE.PET_ADOPTION_COMPLETED,
        title: `${name} ya está en tu cartilla`,
        body: giverName
          ? `${giverName} te pasó su cartilla con vacunas y recordatorios. ¡Gracias por adoptar!`
          : "Ya puedes llevar sus vacunas y recordatorios en tu cartilla. ¡Gracias por adoptar!",
        entityType: "Pet",
        entityId: petId,
        url: petCardUrl(petId),
        metadata: { applicationId: application.id, organizationId: report.organization?.id ?? null },
      });
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_ADOPTION_APPLICATION_COMPLETED,
        summary: `Completó la adopción de "${name.slice(0, 60)}"${giverName ? ` (${giverName.slice(0, 80)})` : ""}`,
        entityType: "AdoptionApplication",
        entityId: application.id,
        metadata: { animalId: report.id, petId, adopterId },
      });
      return {
        success: true,
        message: `${application.applicantName || "La persona"} ya es la familia de ${name}. Su cartilla pasó a su cuenta.`,
        petId,
      };
    } catch (error) {
      console.error("[completeAdoptionApplication]", error);
      return fail(errorMessage(error, "No pudimos completar la adopción. Intenta de nuevo."));
    }
  },
};

export default { typeDefs, definition, resolver };
