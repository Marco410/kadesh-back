import type { KeystoneContext } from "@keystone-6/core/types";
import {
  ADOPTION_APPLICATION_ACTIVE_STATUSES,
  ADOPTION_APPLICATION_STATUS,
} from "../../models/Pet/Animal/AdoptionApplication/constants";
import { NOTIFICATION_TYPE } from "../../models/Notification/constants";
import { notify } from "../notifications/notify";
import { adoptionApplicationUrl } from "./petCard";

function prismaOf(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

/**
 * El animal ya tiene familia (por solicitud, código o correo): la solicitud abierta del adoptante
 * queda «Adoptó» y las demás «Cerrada», con un aviso amable a cada quien. No lanza.
 */
export async function settleApplicationsAfterAdoption(
  context: KeystoneContext,
  {
    animal,
    adopterId,
    petId,
  }: { animal: { id: string; name?: string | null; slug?: string | null }; adopterId: string; petId: string | null },
) {
  try {
    const prisma = prismaOf(context);
    const open = await prisma.adoptionApplication.findMany({
      where: { animalId: animal.id, status: { in: ADOPTION_APPLICATION_ACTIVE_STATUSES } },
      select: { id: true, applicantId: true },
    });
    if (open instanceof Error) throw open;
    const now = new Date();
    const name = animal.name?.trim() || "El animal";
    for (const application of open as Array<{ id: string; applicantId: string | null }>) {
      const adopted = application.applicantId === adopterId;
      await prisma.adoptionApplication.update({
        where: { id: application.id },
        data: adopted
          ? { status: ADOPTION_APPLICATION_STATUS.COMPLETED, petId, decidedAt: now }
          : {
              status: ADOPTION_APPLICATION_STATUS.CLOSED,
              decisionNote: `${name} ya encontró familia.`,
              decidedAt: now,
            },
      });
      if (!adopted && application.applicantId) {
        void notify(context, {
          audience: [application.applicantId],
          product: "pet",
          type: NOTIFICATION_TYPE.ADOPTION_APPLICATION_UPDATED,
          title: `${name} ya encontró familia`,
          body: "Gracias por querer adoptar. Hay más animales esperando un hogar en KADESH.",
          entityType: "AdoptionApplication",
          entityId: application.id,
          url: adoptionApplicationUrl(application.id),
          metadata: { status: ADOPTION_APPLICATION_STATUS.CLOSED },
        });
      }
    }
  } catch (error) {
    console.error("[adoptionApplications] No se pudieron cerrar las solicitudes", { animalId: animal.id }, error);
  }
}
