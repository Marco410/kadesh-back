import type { KeystoneContext } from "@keystone-6/core/types";
import { PET_OWNER_ROLE, PET_STATUS } from "../../models/Pet/constants";
import { mxToday } from "../usage/dailyUsageRollup";
import { copyReportPhotosToPet } from "./petCard";
import { closeReportAsAdopted } from "./reportLogs";
import { animalDisplayName } from "./animalName";

/**
 * Mover una mascota de cuenta y crear cartillas desde un reporte. Lo comparten la ficha de rescate
 * (`convertAnimalToPet`, `completeRescueAdoption`), las solicitudes de adopción y los traspasos
 * con código (`PetTransfer`). Escribe con sudo/prisma: quien llama ya validó permisos.
 */

function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

const SEX_VALUES = new Set(["male", "female", "unknown"]);

/** Lo que se lee del reporte para crear su cartilla. */
export const REPORT_FOR_PET_QUERY =
  "id name slug sex color age physical_description animal_type { id name } animal_breed { id } user { id } organization { id name status } pet { id } duplicateOf { id }";

export type ReportForPet = {
  id: string;
  name?: string | null;
  slug?: string | null;
  sex?: string | null;
  color?: string | null;
  age?: string | null;
  physical_description?: string | null;
  animal_type?: { id: string; name?: string | null } | null;
  animal_breed?: { id: string } | null;
  user?: { id: string } | null;
  organization?: { id: string; name: string; status: string } | null;
  pet?: { id: string } | null;
  duplicateOf?: { id: string } | null;
};

/**
 * Crea la cartilla de un reporte con sus datos y fotos, y liga los dos (`Animal.pet` y
 * `Pet.publicReport`). Con `organization` es ficha de ese espacio (sin dueños); con `ownerId`,
 * mascota de esa persona como dueño principal.
 */
export async function createPetFromReport(
  context: KeystoneContext,
  report: ReportForPet,
  target: { ownerId: string; organization?: null; stage?: null } | { ownerId?: null; organization: { id: string }; stage: string },
): Promise<string> {
  const sudo = context.sudo();
  const created = (await sudo.query.Pet.createOne({
    data: {
      // Sin nombre conocido, la cartilla arranca con la descripción («Perra café»); se puede cambiar.
      name: animalDisplayName({
        name: report.name,
        typeName: report.animal_type?.name,
        sex: report.sex,
        color: report.color,
      }),
      sex: report.sex && SEX_VALUES.has(report.sex) ? report.sex : "unknown",
      color: report.color ?? "",
      approximateAge: report.age ?? "",
      distinctiveMarks: report.physical_description ?? "",
      ...(report.animal_type ? { animal_type: { connect: { id: report.animal_type.id } } } : {}),
      ...(report.animal_breed ? { animal_breed: { connect: { id: report.animal_breed.id } } } : {}),
      ...(target.organization
        ? { organization: { connect: { id: target.organization.id } }, stage: target.stage, intakeDate: mxToday() }
        : {}),
    },
    query: "id",
  })) as { id: string };

  const prisma = prismaOf(context);
  if (target.ownerId) {
    // Con sudo el hook de `Pet` no siempre ve la sesión (y aquí el dueño puede ser otra persona).
    const removed = await prisma.petOwner.deleteMany({ where: { petId: created.id } });
    if (removed instanceof Error) throw removed;
    const owner = await prisma.petOwner.create({
      data: { petId: created.id, userId: target.ownerId, role: PET_OWNER_ROLE.PRINCIPAL },
    });
    if (owner instanceof Error) throw owner;
  }
  // Prisma directo: solo se amarran los registros, sin volver a correr sus hooks.
  const linkedReport = await prisma.animal.update({
    where: { id: report.id },
    data: {
      petId: created.id,
      ...(target.organization && !report.organization ? { organizationId: target.organization.id } : {}),
    },
  });
  if (linkedReport instanceof Error) throw linkedReport;
  const linkedPet = await prisma.pet.update({ where: { id: created.id }, data: { publicReportId: report.id } });
  if (linkedPet instanceof Error) throw linkedPet;

  await copyReportPhotosToPet(context, report.id, created.id);
  return created.id;
}

/** La mascota cambió de manos por otra vía: los códigos sin usar ya no sirven. No lanza. */
export async function cancelPendingTransfers(context: KeystoneContext, petId: string) {
  try {
    const result = await prismaOf(context).petTransfer.updateMany({
      where: { petId, status: "pending" },
      data: { status: "cancelled" },
    });
    if (result instanceof Error) throw result;
  } catch (error) {
    console.error("[petTransfer] No se pudieron cancelar los códigos pendientes", { petId }, error);
  }
}

export type TransferablePet = {
  id: string;
  name: string;
  status: string;
  organizationId: string | null;
  publicReportId: string | null;
};

export async function loadTransferablePet(context: KeystoneContext, petId: string): Promise<TransferablePet | null> {
  const pet = await prismaOf(context).pet.findUnique({
    where: { id: petId },
    select: { id: true, name: true, status: true, organizationId: true, publicReportId: true },
  });
  if (!pet || pet instanceof Error) return null;
  return pet as TransferablePet;
}

/**
 * La mascota pasa a `newOwnerId` como dueño principal, con sus registros, recordatorios y fotos:
 * - Ficha de un espacio de rescate: deja el espacio (organización, etapa y hogar temporal en null)
 *   y queda `adoptedFromOrganization`. Su reporte se cierra «Adoptado» con `reportNote`.
 * - Mascota de una familia: se van todos sus dueños (principal y familia) y entra el nuevo.
 */
export async function transferPetToOwner(
  context: KeystoneContext,
  pet: TransferablePet,
  newOwnerId: string,
  { reportNote }: { reportNote?: string } = {},
) {
  const prisma = prismaOf(context);
  const removed = await prisma.petOwner.deleteMany({ where: { petId: pet.id } });
  if (removed instanceof Error) throw removed;
  const owner = await prisma.petOwner.create({
    data: { petId: pet.id, userId: newOwnerId, role: PET_OWNER_ROLE.PRINCIPAL },
  });
  if (owner instanceof Error) throw owner;
  const updated = await prisma.pet.update({
    where: { id: pet.id },
    data: pet.organizationId
      ? {
          status: PET_STATUS.ACTIVE,
          organizationId: null,
          adoptedFromOrganizationId: pet.organizationId,
          adoptedAt: new Date(),
          stage: null,
          fosterMemberId: null,
        }
      : { status: PET_STATUS.ACTIVE },
  });
  if (updated instanceof Error) throw updated;
  if (pet.publicReportId && reportNote) await closeReportAsAdopted(context, pet.publicReportId, reportNote);
}
