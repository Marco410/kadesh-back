import { GraphQLError } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import createAnimalReport from "../createAnimalReport";
import { ACTIVITY_EVENT } from "../../../../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../../../../models/Notification/constants";
import { canEditAnimalAs } from "../../../../../models/Pet/Animal/Animal.access";
import { PET_RESCUE_STAGE, PET_STATUS } from "../../../../../models/Pet/constants";
import { requireRescueRole } from "../../../../../models/Pet/RescueOrganization/RescueOrganization.access";
import {
  RESCUE_ANIMAL_EDITOR_ROLES,
  RESCUE_ANIMAL_MANAGER_ROLES,
  RESCUE_ORG_ACTIVE_STATUSES,
} from "../../../../../models/Pet/RescueOrganization/constants";
import { getSessionUserId, isPlatformAdmin } from "../../../../../utils/access/tenant";
import { logActivity } from "../../../../../utils/activity/logActivity";
import { notify } from "../../../../../utils/notifications/notify";
import { petPublicUrl } from "../../../../../utils/pet/animalReport";
import { copyPetPhotosToReport, petAgeLabel, petCardUrl } from "../../../../../utils/pet/petCard";
import { settleApplicationsAfterAdoption } from "../../../../../utils/pet/adoptionApplications";
import {
  REPORT_FOR_PET_QUERY,
  cancelPendingTransfers,
  createPetFromReport,
  loadTransferablePet,
  transferPetToOwner,
  type ReportForPet,
} from "../../../../../utils/pet/petTransfer";
import {
  HOME_REPORT_STATUSES,
  addReportLog,
  lastReportLog,
  type LogLocation,
} from "../../../../../utils/pet/reportLogs";
import { displayName, prismaOf } from "./shared";

/**
 * Ficha interna (cartilla) de los animales de un espacio de rescate. Ver
 * models/Pet/RescueOrganization/README.md («Fichas internas»).
 *
 * - `convertAnimalToPet`: de un reporte a una cartilla. Con `organizationId`, ficha del espacio
 *   («Crear ficha»); sin él, «Se quedó conmigo»: la cartilla es de quien publicó el reporte y
 *   el reporte se cierra «En familia».
 * - `publishRescuePet`: publica la ficha en adopción o como rescatado. Si ya tiene reporte, le
 *   agrega la bitácora; si no, crea el reporte (con sus fotos) a nombre del espacio.
 * - `completeRescueAdoption`: la cartilla pasa al adoptante (dueño principal) con sus vacunas y
 *   recordatorios; el espacio deja de verla y el reporte queda «Adoptado».
 */

/** Estados con los que el equipo publica una ficha. `lost` sigue siendo de la cartilla familiar. */
const PUBLISHABLE_STATUSES = ["in_adoption", "rescued"] as const;
type PublishableStatus = (typeof PUBLISHABLE_STATUSES)[number];
const STATUS_LABEL: Record<PublishableStatus, string> = {
  in_adoption: "En adopción",
  rescued: "Rescatado",
};

export const RESCUE_ADOPTER_NOT_FOUND = "RESCUE_ADOPTER_NOT_FOUND";

const typeDefs = `
  type RescuePetResult {
    success: Boolean!
    message: String!
    petId: ID
    "Espacio de la ficha; null si quedó en tu cartilla («Se quedó conmigo»)"
    organizationId: ID
  }

  type PublishRescuePetResult {
    success: Boolean!
    message: String!
    reportId: ID
    slug: String
    url: String
    "true si se creó un reporte nuevo; false si se agregó la bitácora al que ya tenía"
    createdReport: Boolean!
  }

  type CompleteRescueAdoptionResult {
    success: Boolean!
    message: String!
    "RESCUE_ADOPTER_NOT_FOUND cuando el correo no tiene cuenta"
    code: String
    petId: ID
    adopterName: String
  }
`;

const definition = `
  convertAnimalToPet(animalId: ID!, organizationId: ID): RescuePetResult!
  "status: in_adoption | rescued. location es obligatoria si la ficha aún no tiene reporte."
  publishRescuePet(petId: ID!, status: String!, location: PetLastSeenLocationInput, notes: String): PublishRescuePetResult!
  completeRescueAdoption(petId: ID!, email: String!): CompleteRescueAdoptionResult!
`;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof GraphQLError || error instanceof Error ? error.message || fallback : fallback;
}

function stageForReportStatus(status: string | null | undefined): string {
  return status === "in_adoption" ? PET_RESCUE_STAGE.AVAILABLE : PET_RESCUE_STAGE.INTAKE;
}

type RescuePetRow = {
  id: string;
  name: string;
  status: string;
  sex?: string | null;
  color?: string | null;
  distinctiveMarks?: string | null;
  approximateAge?: string | null;
  birthday?: string | null;
  animal_type?: { id: string } | null;
  animal_breed?: { id: string } | null;
  organization?: { id: string; name: string; status: string; whatsapp?: string | null } | null;
  publicReport?: { id: string; slug?: string | null } | null;
};

const RESCUE_PET_QUERY =
  "id name status sex color distinctiveMarks approximateAge birthday animal_type { id } animal_breed { id } organization { id name status whatsapp } publicReport { id slug }";

async function loadRescuePet(context: KeystoneContext, petId: string): Promise<RescuePetRow> {
  const pet = (await context.sudo().query.Pet.findOne({
    where: { id: petId },
    query: RESCUE_PET_QUERY,
  })) as RescuePetRow | null;
  if (!pet) throw new GraphQLError("No encontramos esta ficha.");
  if (!pet.organization) throw new GraphQLError("Esta mascota no es ficha de un espacio de rescate.");
  return pet;
}

const resolver = {
  convertAnimalToPet: async (
    _root: unknown,
    { animalId, organizationId }: { animalId: string; organizationId?: string | null },
    context: KeystoneContext,
  ) => {
    const fail = (message: string) => ({ success: false, message, petId: null, organizationId: null });
    try {
      const userId = getSessionUserId(context.session);
      if (!userId) return fail("Inicia sesión para continuar.");
      const animal = (await context.sudo().query.Animal.findOne({
        where: { id: animalId },
        query: REPORT_FOR_PET_QUERY,
      })) as ReportForPet | null;
      if (!animal) return fail("No encontramos ese reporte.");
      if (animal.duplicateOf) return fail("Este reporte está unido a otro: hazlo desde el reporte principal.");
      if (animal.pet) return fail("Este animal ya tiene cartilla.");
      const canEdit =
        isPlatformAdmin(context.session) ||
        (await canEditAnimalAs(
          context,
          { userId: animal.user?.id ?? null, organizationId: animal.organization?.id ?? null },
          userId,
        ));
      if (!canEdit) return fail("Solo quien publicó el reporte (o el equipo de su espacio) puede hacer esto.");

      let organization: { id: string; name: string } | null = null;
      if (organizationId) {
        const { organization: org } = await requireRescueRole(context, organizationId, RESCUE_ANIMAL_EDITOR_ROLES);
        if (!RESCUE_ORG_ACTIVE_STATUSES.includes(org.status)) return fail("Este espacio de rescate no está activo.");
        if (animal.organization && animal.organization.id !== org.id) {
          return fail("Este reporte es de otro espacio de rescate.");
        }
        organization = org;
      } else if (animal.organization) {
        return fail("Este reporte es de un espacio de rescate: crea su ficha desde el panel del espacio.");
      }

      const last = await lastReportLog(context, animal.id);
      const petId = organization
        ? await createPetFromReport(context, animal, {
            organization,
            stage: stageForReportStatus(last?.status),
          })
        : await createPetFromReport(context, animal, { ownerId: userId });

      const name = animal.name?.trim() || "este animal";
      if (organization) {
        void logActivity(context, {
          type: ACTIVITY_EVENT.PET_RESCUE_PET_CREATED,
          summary: `Creó la ficha de "${name.slice(0, 60)}" en "${organization.name.slice(0, 80)}"`,
          entityType: "Pet",
          entityId: petId,
          metadata: { organizationId: organization.id, animalId: animal.id },
        });
        return {
          success: true,
          message: `${name} ya tiene ficha en ${organization.name}.`,
          petId,
          organizationId: organization.id,
        };
      }

      if (!last || !HOME_REPORT_STATUSES.includes(last.status ?? "")) {
        await addReportLog(context, animal.id, "in_family", "Se quedó con quien lo rescató.", last);
      }
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_ANIMAL_KEPT,
        summary: `Pasó a su cartilla a "${name.slice(0, 60)}"`,
        entityType: "Pet",
        entityId: petId,
        metadata: { animalId: animal.id },
      });
      return { success: true, message: `${name} ya está en tu cartilla.`, petId, organizationId: null };
    } catch (error) {
      console.error("[convertAnimalToPet]", error);
      return fail(errorMessage(error, "No pudimos crear la cartilla. Intenta de nuevo."));
    }
  },

  publishRescuePet: async (
    _root: unknown,
    args: { petId: string; status: string; location?: LogLocation | null; notes?: string | null },
    context: KeystoneContext,
  ) => {
    const fail = (message: string) => ({
      success: false,
      message,
      reportId: null,
      slug: null,
      url: null,
      createdReport: false,
    });
    try {
      if (!PUBLISHABLE_STATUSES.includes(args.status as PublishableStatus)) {
        return fail("Elige si lo publicas en adopción o como rescatado.");
      }
      const status = args.status as PublishableStatus;
      const pet = await loadRescuePet(context, args.petId);
      const org = pet.organization!;
      const { userId } = await requireRescueRole(context, org.id, RESCUE_ANIMAL_EDITOR_ROLES);
      if (!RESCUE_ORG_ACTIVE_STATUSES.includes(org.status)) return fail("Este espacio de rescate no está activo.");
      if (pet.status !== PET_STATUS.ACTIVE) return fail("Solo se publica una ficha activa.");
      const notes = args.notes?.trim() ?? "";
      const prisma = prismaOf(context);

      let reportId: string;
      let slug: string;
      let createdReport = false;
      if (pet.publicReport) {
        reportId = pet.publicReport.id;
        slug = pet.publicReport.slug || pet.publicReport.id;
        const last = await lastReportLog(context, reportId);
        if (last?.status === status) return fail(`Ya está publicado como «${STATUS_LABEL[status]}».`);
        await addReportLog(context, reportId, status, notes, last, args.location);
      } else {
        if (!args.location?.lat || !args.location?.lng) return fail("Marca en el mapa dónde está el animal.");
        if (!pet.animal_type?.id) return fail("Elige la especie en la ficha antes de publicarla.");
        let phone = org.whatsapp?.trim() || "";
        if (!phone) {
          const user = (await context.sudo().query.User.findOne({
            where: { id: userId },
            query: "phone",
          })) as { phone?: string | null } | null;
          phone = user?.phone?.trim() || "";
        }
        if (!phone) return fail("Agrega el WhatsApp del espacio en su perfil público para publicar.");

        const report = (await createAnimalReport.resolver.createAnimalReport(
          null,
          {
            input: {
              type: pet.animal_type.id,
              breed: pet.animal_breed?.id ?? null,
              name: pet.name,
              sex: pet.sex || "unknown",
              color: pet.color || "",
              marks: pet.distinctiveMarks || "",
              age: petAgeLabel(pet.birthday, pet.approximateAge),
              status,
              lat: String(args.location.lat),
              lng: String(args.location.lng),
              addressText: args.location.address ?? "",
              phone,
              note: notes,
              reportedBy: "volunteer",
              reporterUserId: userId,
              // Es un animal del propio espacio: no frenar por "parece duplicado".
              confirmDuplicate: true,
            },
          },
          context,
        )) as { id: string; slug: string; url: string };
        reportId = report.id;
        slug = report.slug;
        createdReport = true;
        const linkedReport = await prisma.animal.update({
          where: { id: report.id },
          data: { organizationId: org.id, petId: pet.id },
        });
        if (linkedReport instanceof Error) throw linkedReport;
        await copyPetPhotosToReport(context, pet.id, report.id);
      }

      const updated = await prisma.pet.update({
        where: { id: pet.id },
        data: {
          publicReportId: reportId,
          ...(status === "in_adoption" ? { stage: PET_RESCUE_STAGE.AVAILABLE } : {}),
        },
      });
      if (updated instanceof Error) throw updated;

      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_RESCUE_PET_PUBLISHED,
        summary: `Publicó a "${pet.name.slice(0, 60)}" como ${STATUS_LABEL[status]} (${org.name.slice(0, 80)})`,
        entityType: "Pet",
        entityId: pet.id,
        metadata: { organizationId: org.id, reportId, status, createdReport },
      });
      return {
        success: true,
        message: `${pet.name} ya está publicado como «${STATUS_LABEL[status]}».`,
        reportId,
        slug,
        url: petPublicUrl(slug),
        createdReport,
      };
    } catch (error) {
      console.error("[publishRescuePet]", error);
      return fail(errorMessage(error, "No pudimos publicar la ficha. Intenta de nuevo."));
    }
  },

  completeRescueAdoption: async (
    _root: unknown,
    { petId, email }: { petId: string; email: string },
    context: KeystoneContext,
  ) => {
    const fail = (message: string, code: string | null = null) => ({
      success: false,
      message,
      code,
      petId: null,
      adopterName: null,
    });
    try {
      const pet = await loadRescuePet(context, petId);
      const org = pet.organization!;
      await requireRescueRole(context, org.id, RESCUE_ANIMAL_MANAGER_ROLES);
      if (pet.status !== PET_STATUS.ACTIVE) return fail("Solo se adopta una ficha activa.");
      const clean = (email ?? "").trim().toLowerCase();
      if (!clean) return fail("Escribe el correo de quien adopta.");

      const [adopter] = (await context.sudo().query.User.findMany({
        where: { email: { equals: clean, mode: "insensitive" } },
        query: "id name lastName",
        take: 1,
      })) as Array<{ id: string; name?: string | null; lastName?: string | null }>;
      if (!adopter) {
        return fail(
          "No encontramos una cuenta de KADESH con ese correo. Pídele que se registre (es gratis) y vuelve a intentarlo.",
          RESCUE_ADOPTER_NOT_FOUND,
        );
      }

      const transferable = await loadTransferablePet(context, pet.id);
      if (!transferable) return fail("No encontramos esta ficha.");
      await transferPetToOwner(context, transferable, adopter.id, {
        reportNote: `Adoptado con ${org.name} en KADESH.`,
      });
      await cancelPendingTransfers(context, pet.id);
      if (pet.publicReport) {
        await settleApplicationsAfterAdoption(context, {
          animal: { id: pet.publicReport.id, name: pet.name, slug: pet.publicReport.slug },
          adopterId: adopter.id,
          petId: pet.id,
        });
      }

      const adopterName = displayName(adopter) || "La persona";
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_RESCUE_ADOPTION_COMPLETED,
        summary: `Completó la adopción de "${pet.name.slice(0, 60)}" (${org.name.slice(0, 80)})`,
        entityType: "Pet",
        entityId: pet.id,
        metadata: { organizationId: org.id, adopterId: adopter.id, reportId: pet.publicReport?.id ?? null },
      });
      void notify(context, {
        audience: [adopter.id],
        product: "pet",
        type: NOTIFICATION_TYPE.PET_ADOPTION_COMPLETED,
        title: `${pet.name} ya está en tu cartilla`,
        body: `${org.name} te pasó su cartilla con vacunas y recordatorios. ¡Gracias por adoptar!`,
        entityType: "Pet",
        entityId: pet.id,
        url: petCardUrl(pet.id),
        metadata: { organizationId: org.id },
      });

      return {
        success: true,
        message: `${adopterName} ya es la familia de ${pet.name}. Su cartilla pasó a su cuenta.`,
        code: null,
        petId: pet.id,
        adopterName,
      };
    } catch (error) {
      console.error("[completeRescueAdoption]", error);
      return fail(errorMessage(error, "No pudimos completar la adopción. Intenta de nuevo."));
    }
  },
};

export default { typeDefs, definition, resolver };
