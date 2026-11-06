import { GraphQLError } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import createAnimalReport from "../createAnimalReport";
import { ACTIVITY_EVENT } from "../../../../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../../../../models/Notification/constants";
import { canEditAnimalAs } from "../../../../../models/Pet/Animal/Animal.access";
import { PET_OWNER_ROLE, PET_RESCUE_STAGE, PET_STATUS } from "../../../../../models/Pet/constants";
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
import {
  copyPetPhotosToReport,
  copyReportPhotosToPet,
  petAgeLabel,
  petCardUrl,
} from "../../../../../utils/pet/petCard";
import { mxToday } from "../../../../../utils/usage/dailyUsageRollup";
import { displayName, prismaOf } from "./shared";

/**
 * Ficha interna (cartilla) de los animales de un espacio de rescate. Ver
 * models/Pet/RescueOrganization/README.md («Fase 2»).
 *
 * - `convertAnimalToPet`: de un reporte a una cartilla. Con `organizationId`, ficha del espacio
 *   («Agregar a fichas»); sin él, «Se quedó conmigo»: la cartilla es de quien publicó el reporte y
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
/** El reporte ya no busca hogar: no tiene caso volver a publicarlo desde la ficha. */
const CLOSED_REPORT_STATUSES = ["adopted", "in_family"];
const SEX_VALUES = new Set(["male", "female", "unknown"]);

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

type LastLog = {
  status?: string | null;
  lat?: string | null;
  lng?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  placeLabel?: string | null;
};

type Location = { lat: string; lng: string; address?: string | null };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof GraphQLError || error instanceof Error ? error.message || fallback : fallback;
}

async function lastReportLog(context: KeystoneContext, reportId: string): Promise<LastLog | null> {
  const [last] = (await context.sudo().query.AnimalLog.findMany({
    where: { animal: { id: { equals: reportId } } },
    orderBy: [{ date_status: "desc" }, { createdAt: "desc" }],
    take: 1,
    query: "status lat lng address city state country neighborhood postalCode placeLabel",
  })) as LastLog[];
  return last ?? null;
}

/**
 * Agrega una bitácora al reporte. Sin `location` repite la ubicación de la última (para que el pin
 * no se mueva); con ella, el hook de `AnimalLog` completa ciudad y estado.
 */
async function addReportLog(
  context: KeystoneContext,
  reportId: string,
  status: string,
  notes: string,
  last: LastLog | null,
  location?: Location | null,
) {
  const place = location
    ? { lat: String(location.lat), lng: String(location.lng), address: location.address ?? "" }
    : {
        lat: last?.lat ?? "",
        lng: last?.lng ?? "",
        address: last?.address ?? "",
        city: last?.city ?? "",
        state: last?.state ?? "",
        country: last?.country ?? "",
        neighborhood: last?.neighborhood ?? "",
        postalCode: last?.postalCode ?? "",
        placeLabel: last?.placeLabel ?? "",
      };
  await context.sudo().query.AnimalLog.createOne({
    data: {
      animal: { connect: { id: reportId } },
      status,
      notes,
      date_status: new Date().toISOString(),
      last_seen: false,
      ...place,
    },
    query: "id",
  });
}

function stageForReportStatus(status: string | null | undefined): string {
  return status === "in_adoption" ? PET_RESCUE_STAGE.AVAILABLE : PET_RESCUE_STAGE.INTAKE;
}

type AnimalForPet = {
  id: string;
  name?: string | null;
  slug?: string | null;
  sex?: string | null;
  color?: string | null;
  age?: string | null;
  physical_description?: string | null;
  animal_type?: { id: string } | null;
  animal_breed?: { id: string } | null;
  user?: { id: string } | null;
  organization?: { id: string; name: string; status: string } | null;
  pet?: { id: string } | null;
  duplicateOf?: { id: string } | null;
};

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
      const sudo = context.sudo();
      const animal = (await sudo.query.Animal.findOne({
        where: { id: animalId },
        query:
          "id name slug sex color age physical_description animal_type { id } animal_breed { id } user { id } organization { id name status } pet { id } duplicateOf { id }",
      })) as AnimalForPet | null;
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
      const created = (await sudo.query.Pet.createOne({
        data: {
          name: animal.name?.trim() || "Sin nombre",
          sex: animal.sex && SEX_VALUES.has(animal.sex) ? animal.sex : "unknown",
          color: animal.color ?? "",
          approximateAge: animal.age ?? "",
          distinctiveMarks: animal.physical_description ?? "",
          ...(animal.animal_type ? { animal_type: { connect: { id: animal.animal_type.id } } } : {}),
          ...(animal.animal_breed ? { animal_breed: { connect: { id: animal.animal_breed.id } } } : {}),
          ...(organization
            ? {
                organization: { connect: { id: organization.id } },
                stage: stageForReportStatus(last?.status),
                intakeDate: mxToday(),
              }
            : {}),
        },
        query: "id",
      })) as { id: string };

      const prisma = prismaOf(context);
      if (!organization) {
        // Con sudo el hook no siempre ve la sesión: el principal se crea aquí si falta.
        const owners = await sudo.query.PetOwner.count({ where: { pet: { id: { equals: created.id } } } });
        if (owners === 0) {
          await sudo.query.PetOwner.createOne({
            data: {
              pet: { connect: { id: created.id } },
              user: { connect: { id: userId } },
              role: PET_OWNER_ROLE.PRINCIPAL,
            },
            query: "id",
          });
        }
      }
      // Prisma directo: solo se amarran los registros, sin volver a correr sus hooks.
      const linkedReport = await prisma.animal.update({
        where: { id: animal.id },
        data: { petId: created.id, ...(organization && !animal.organization ? { organizationId: organization.id } : {}) },
      });
      if (linkedReport instanceof Error) throw linkedReport;
      const linkedPet = await prisma.pet.update({ where: { id: created.id }, data: { publicReportId: animal.id } });
      if (linkedPet instanceof Error) throw linkedPet;

      await copyReportPhotosToPet(context, animal.id, created.id);

      const name = animal.name?.trim() || "este animal";
      if (organization) {
        void logActivity(context, {
          type: ACTIVITY_EVENT.PET_RESCUE_PET_CREATED,
          summary: `Creó la ficha de "${name.slice(0, 60)}" en "${organization.name.slice(0, 80)}"`,
          entityType: "Pet",
          entityId: created.id,
          metadata: { organizationId: organization.id, animalId: animal.id },
        });
        return {
          success: true,
          message: `${name} ya tiene ficha en ${organization.name}.`,
          petId: created.id,
          organizationId: organization.id,
        };
      }

      if (!last || !CLOSED_REPORT_STATUSES.includes(last.status ?? "")) {
        await addReportLog(context, animal.id, "in_family", "Se quedó con quien lo rescató.", last);
      }
      void logActivity(context, {
        type: ACTIVITY_EVENT.PET_ANIMAL_KEPT,
        summary: `Pasó a su cartilla a "${name.slice(0, 60)}"`,
        entityType: "Pet",
        entityId: created.id,
        metadata: { animalId: animal.id },
      });
      return {
        success: true,
        message: `${name} ya está en tu cartilla.`,
        petId: created.id,
        organizationId: null,
      };
    } catch (error) {
      console.error("[convertAnimalToPet]", error);
      return fail(errorMessage(error, "No pudimos crear la cartilla. Intenta de nuevo."));
    }
  },

  publishRescuePet: async (
    _root: unknown,
    args: { petId: string; status: string; location?: Location | null; notes?: string | null },
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

      const sudo = context.sudo();
      const [adopter] = (await sudo.query.User.findMany({
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

      // El adoptante queda como principal; la ficha deja de ser del espacio (y su equipo de verla).
      await sudo.query.PetOwner.createOne({
        data: {
          pet: { connect: { id: pet.id } },
          user: { connect: { id: adopter.id } },
          role: PET_OWNER_ROLE.PRINCIPAL,
        },
        query: "id",
      });
      const prisma = prismaOf(context);
      const updated = await prisma.pet.update({
        where: { id: pet.id },
        data: {
          organizationId: null,
          adoptedFromOrganizationId: org.id,
          adoptedAt: new Date(),
          stage: null,
          fosterMemberId: null,
        },
      });
      if (updated instanceof Error) throw updated;

      if (pet.publicReport) {
        try {
          const last = await lastReportLog(context, pet.publicReport.id);
          if (last?.status !== "adopted") {
            await addReportLog(context, pet.publicReport.id, "adopted", `Adoptado con ${org.name} en KADESH.`, last);
          }
        } catch (error) {
          // La adopción ya quedó; el reporte se puede cerrar a mano.
          console.error("[completeRescueAdoption] No se pudo cerrar el reporte", { petId: pet.id }, error);
        }
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
