import type { KeystoneContext } from "@keystone-6/core/types";
import { Role } from "../../models/Role/constants";
import type { NotificationType } from "../../models/Notification/constants";
import { sendPushToUsers } from "./push";
import { sendNotificationWhatsappToOptedIn, type NotificationTemplateValues } from "./whatsapp";

export type NotifyInput = {
  /** "platform_admins" = una fila por cada admin de plataforma; si no, ids de usuario. */
  audience: "platform_admins" | string[];
  product: "pet" | "saas";
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  url?: string | null;
  metadata?: Record<string, unknown> | null;
  /**
   * Valores crudos para la plantilla de WhatsApp del tipo (`utils/notifications/whatsapp.ts`).
   * No se guardan en `Notification`. Solo les llega a quienes activaron `whatsappNotifications`.
   */
  templateValues?: NotificationTemplateValues;
};

/**
 * Crea notificaciones en la campana y, si son de Kadesh Pet, manda el push a la app (sin esperar
 * la respuesta de Expo). Igual que `logActivity`: usa sudo, nunca lanza y no debe frenar la
 * operación que la dispara (llamar con `void notify(...)` o dentro de try).
 * No guardar datos sensibles en `body`/`metadata` (contraseñas, tokens, datos bancarios).
 */
export async function notify(context: KeystoneContext, input: NotifyInput): Promise<number> {
  try {
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    if (!prisma?.notification) return 0;

    let recipientIds: string[];
    if (input.audience === "platform_admins") {
      const admins: Array<{ id: string }> = await prisma.user.findMany({
        where: { roles: { some: { name: Role.ADMIN } } },
        select: { id: true },
      });
      recipientIds = admins.map((admin) => admin.id);
    } else {
      recipientIds = [...new Set(input.audience.filter(Boolean))];
    }
    if (recipientIds.length === 0) return 0;

    const result = await prisma.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        recipientId,
        product: input.product,
        type: input.type,
        title: input.title,
        body: input.body ?? "",
        entityType: input.entityType ?? "",
        entityId: input.entityId ?? "",
        url: input.url ?? "",
        metadata: input.metadata ?? undefined,
      })),
    });
    // Prisma de Keystone devuelve el error en vez de lanzarlo.
    if (result instanceof Error) throw result;

    if (input.product === "pet") {
      void sendPushToUsers(context, recipientIds, {
        title: input.title,
        body: input.body,
        url: input.url,
        type: input.type,
      });
    }
    // Sin await: el envío no frena la operación que dispara la notificación.
    void sendNotificationWhatsappToOptedIn(prisma, recipientIds, input.type, input.templateValues ?? {});

    return result?.count ?? recipientIds.length;
  } catch (error) {
    console.error("[notify] No se pudo crear la notificación:", input.type, error);
    return 0;
  }
}

/**
 * Los correos al admin quedan apagados salvo `ADMIN_NOTIFICATION_EMAILS=on`: ahora el aviso
 * llega a la campana de Operaciones.
 */
export function adminNotificationEmailsEnabled(): boolean {
  return (process.env.ADMIN_NOTIFICATION_EMAILS ?? "off").trim().toLowerCase() === "on";
}
