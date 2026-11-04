import { WHATSAPP_DELIVERY, type WhatsappDelivery } from "../../models/Notification/constants";

/**
 * Registro de entrega por canal en cada `Notification` (a dónde se fue un aviso). Lo escriben
 * `push.ts` y `whatsapp.ts` después de mandar, y el webhook de WhatsApp cuando Meta avisa que se
 * entregó, se leyó o falló. Nunca lanza: registrar no debe tocar el envío.
 */

/** destinatario → id de su `Notification` en esta llamada a `notify`. */
export type NotificationIds = Map<string, string>;

const DETAIL_MAX = 300;

/** Prisma de Keystone puede devolver el error en vez de lanzarlo. */
async function run(label: string, work: () => Promise<unknown>) {
  try {
    const result = await work();
    if (result instanceof Error) throw result;
  } catch (error) {
    console.error(`[notify:delivery] No se pudo registrar ${label}:`, error instanceof Error ? error.message : error);
  }
}

export function deliveryDetail(value: unknown): string {
  const text = (value instanceof Error ? value.message : String(value ?? "")).replace(/\s+/g, " ").trim();
  return text.length > DETAIL_MAX ? `${text.slice(0, DETAIL_MAX - 1)}…` : text;
}

/** Mismos datos para varias notificaciones (p. ej. todas las de push «sin app»). */
export async function recordDelivery(prisma: any, ids: string[], data: Record<string, unknown>): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length || !prisma?.notification) return;
  await run("la entrega", () => prisma.notification.updateMany({ where: { id: { in: unique } }, data }));
}

/** Agrupa por la misma carga (`key`) para hacer un `updateMany` por grupo. */
export async function recordDeliveryGroups(
  prisma: any,
  groups: Map<string, { ids: string[]; data: Record<string, unknown> }>,
): Promise<void> {
  await Promise.all([...groups.values()].map((group) => recordDelivery(prisma, group.ids, group.data)));
}

/** Orden de los estados de Meta: un acuse viejo que llega tarde no regresa el estado. */
const PREVIOUS: Partial<Record<WhatsappDelivery, WhatsappDelivery[]>> = {
  [WHATSAPP_DELIVERY.SENT]: [WHATSAPP_DELIVERY.ACCEPTED],
  [WHATSAPP_DELIVERY.DELIVERED]: [WHATSAPP_DELIVERY.ACCEPTED, WHATSAPP_DELIVERY.SENT],
  [WHATSAPP_DELIVERY.READ]: [WHATSAPP_DELIVERY.ACCEPTED, WHATSAPP_DELIVERY.SENT, WHATSAPP_DELIVERY.DELIVERED],
  [WHATSAPP_DELIVERY.FAILED]: [WHATSAPP_DELIVERY.ACCEPTED, WHATSAPP_DELIVERY.SENT, WHATSAPP_DELIVERY.DELIVERED],
};

export type WhatsappWebhookStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
};

/**
 * Acuses del webhook (sent / delivered / read / failed) → la `Notification` con ese `wamid`.
 * Los mensajes del CRM no tienen `Notification`: el `updateMany` no toca nada.
 */
export async function recordWhatsappStatuses(prisma: any, statuses: WhatsappWebhookStatus[] | undefined): Promise<void> {
  if (!statuses?.length || !prisma?.notification) return;
  await Promise.all(
    statuses.map(async (status) => {
      const next = status.status as WhatsappDelivery | undefined;
      const from = next ? PREVIOUS[next] : undefined;
      if (!status.id || !next || !from) return;
      const seconds = Number(status.timestamp);
      const error = status.errors?.[0];
      await run(`el acuse ${next}`, () =>
        prisma.notification.updateMany({
          where: { whatsappMessageId: status.id, whatsappStatus: { in: from } },
          data: {
            whatsappStatus: next,
            whatsappUpdatedAt: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date(),
            ...(next === WHATSAPP_DELIVERY.FAILED
              ? {
                  whatsappDetail: deliveryDetail(
                    [error?.code, error?.title, error?.error_data?.details].filter(Boolean).join(" · ") || "Meta no lo entregó",
                  ),
                }
              : {}),
          },
        }),
      );
    }),
  );
}
