import type { KeystoneContext } from "@keystone-6/core/types";

/**
 * Push a la app de Kadesh Pet con la API de Expo (https://docs.expo.dev/push-notifications/sending-notifications/).
 * Sin SDK: son dos endpoints HTTP. Igual que `notify`, nunca lanza.
 */
const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
/** Expo acepta hasta 100 mensajes por petición. */
const CHUNK = 100;
/** Los recibos están listos unos minutos después; Expo sugiere esperar ~15 min. */
const RECEIPTS_DELAY_MS = 15 * 60 * 1000;

export type PushMessage = {
  title: string;
  body?: string | null;
  /** Ruta o URL de pet.kadesh.com.mx que abre la app al tocar la notificación. */
  url?: string | null;
  /** Tipo de notificación (`animal.nearby`…), para que la app elija el canal o el ícono. */
  type?: string | null;
};

type PushTicket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };
type PushReceipt = { status: "ok" } | { status: "error"; message?: string; details?: { error?: string } };

const isExpoToken = (token: string) => /^Expo(nent)?PushToken\[.+\]$/.test(token);

function expoHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  // Opcional: solo si se activa "Enhanced security" en el proyecto de Expo.
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

function prismaOf(context: KeystoneContext) {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

/** Borra tokens que Expo reporta como dados de baja (app desinstalada o permiso retirado). */
async function forgetTokens(context: KeystoneContext, tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const result = await prismaOf(context).tokenNotification.deleteMany({ where: { token: { in: tokens } } });
  if (result instanceof Error) throw result;
}

async function checkReceipts(context: KeystoneContext, ticketTokens: Map<string, string>): Promise<void> {
  try {
    const ids = [...ticketTokens.keys()];
    const dead: string[] = [];
    for (let start = 0; start < ids.length; start += 1000) {
      const response = await fetch(RECEIPTS_URL, {
        method: "POST",
        headers: expoHeaders(),
        body: JSON.stringify({ ids: ids.slice(start, start + 1000) }),
      });
      if (!response.ok) continue;
      const json = (await response.json()) as { data?: Record<string, PushReceipt> };
      for (const [id, receipt] of Object.entries(json.data ?? {})) {
        if (receipt.status === "error" && receipt.details?.error === "DeviceNotRegistered") {
          const token = ticketTokens.get(id);
          if (token) dead.push(token);
        }
      }
    }
    await forgetTokens(context, dead);
  } catch (error) {
    console.error("[push] No se pudieron revisar los recibos:", error);
  }
}

/**
 * Manda la notificación a todos los dispositivos registrados de esas personas. Devuelve cuántos
 * mensajes aceptó Expo. Los tokens dados de baja se borran (al momento y al revisar los recibos).
 */
export async function sendPushToUsers(
  context: KeystoneContext,
  userIds: string[],
  message: PushMessage,
): Promise<number> {
  try {
    if (userIds.length === 0) return 0;
    const rows = await prismaOf(context).tokenNotification.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    if (rows instanceof Error) throw rows;

    const tokens = [...new Set((rows as Array<{ token: string }>).map((row) => row.token).filter(isExpoToken))];
    if (tokens.length === 0) return 0;

    let accepted = 0;
    const dead: string[] = [];
    const ticketTokens = new Map<string, string>();

    for (let start = 0; start < tokens.length; start += CHUNK) {
      const batch = tokens.slice(start, start + CHUNK);
      const response = await fetch(SEND_URL, {
        method: "POST",
        headers: expoHeaders(),
        body: JSON.stringify(
          batch.map((to) => ({
            to,
            title: message.title,
            body: message.body ?? undefined,
            sound: "default",
            priority: "high",
            channelId: "alerts",
            data: { url: message.url ?? null, type: message.type ?? null },
          })),
        ),
      });
      if (!response.ok) {
        console.error("[push] Expo respondió", response.status, await response.text().catch(() => ""));
        continue;
      }
      const json = (await response.json()) as { data?: PushTicket[] };
      (json.data ?? []).forEach((ticket, index) => {
        const token = batch[index];
        if (!token) return;
        if (ticket.status === "ok") {
          accepted += 1;
          ticketTokens.set(ticket.id, token);
        } else if (ticket.details?.error === "DeviceNotRegistered") {
          dead.push(token);
        }
      });
    }

    await forgetTokens(context, dead);
    if (ticketTokens.size > 0) {
      const timer = setTimeout(() => void checkReceipts(context, ticketTokens), RECEIPTS_DELAY_MS);
      timer.unref?.();
    }
    return accepted;
  } catch (error) {
    console.error("[push] No se pudo enviar:", message.type, error);
    return 0;
  }
}
