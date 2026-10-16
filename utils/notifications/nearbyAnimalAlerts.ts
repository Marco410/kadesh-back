import type { KeystoneContext } from "@keystone-6/core/types";
import { NOTIFICATION_TYPE } from "../../models/Notification/constants";
import { notify } from "./notify";

/** Estatus que avisan a la zona: se busca a su familia. */
const ALERT_STATUSES = new Set(["lost", "found"]);
/** Máximo de alertas de zona por persona en 24 h, para que no se vuelva ruido. */
export const MAX_NEARBY_ALERTS_PER_DAY = 5;
/** Un reporte con fecha más vieja (importado o atrasado) ya no avisa. */
const MAX_REPORT_AGE_MS = 3 * 24 * 60 * 60 * 1000;

const TYPE_LABEL: Record<string, string> = {
  dog: "perro",
  cat: "gato",
  bird: "ave",
  fish: "pez",
  reptil: "reptil",
  mammal: "mamífero",
};

export type NearbyAnimalInput = {
  animalId: string;
  /** Quien reportó: no se avisa a sí mismo. */
  ownerId?: string | null;
  name?: string | null;
  type?: string | null;
  status?: string | null;
  lat: number;
  lng: number;
  /** "Col. Centro, Morelia". */
  place?: string | null;
  /** Fecha del avistamiento (`date_status`). */
  seenAt?: string | Date | null;
  url?: string | null;
  slug?: string | null;
};

/**
 * Avisa (campana + push) a quienes tienen alertas activas y su zona incluye el lugar del reporte.
 * Se llama con el primer registro con ubicación de un animal perdido o encontrado. Nunca lanza.
 */
export async function notifyNearbyAnimal(context: KeystoneContext, input: NearbyAnimalInput): Promise<number> {
  try {
    const status = (input.status ?? "").toLowerCase();
    if (!ALERT_STATUSES.has(status)) return 0;
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return 0;
    if (input.lat === 0 && input.lng === 0) return 0;
    if (input.seenAt) {
      const seen = new Date(input.seenAt).getTime();
      if (Number.isFinite(seen) && Date.now() - seen > MAX_REPORT_AGE_MS) return 0;
    }

    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    const ownerId = input.ownerId ?? "";
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Distancia con haversine en SQL (km). Excluye cuentas suspendidas o anonimizadas, al autor,
    // a quien ya recibió la alerta de este animal y a quien llegó al tope del día.
    const rows = await prisma.$queryRaw`
      SELECT u.id
      FROM "User" u
      WHERE u."petAlertsEnabled" = true
        AND u."alertLat" IS NOT NULL
        AND u."alertLng" IS NOT NULL
        AND u."suspendedAt" IS NULL
        AND u."anonymizedAt" IS NULL
        AND u.id <> ${ownerId}
        AND 6371 * acos(LEAST(1, GREATEST(-1,
              cos(radians(${input.lat})) * cos(radians(u."alertLat")) * cos(radians(u."alertLng") - radians(${input.lng}))
              + sin(radians(${input.lat})) * sin(radians(u."alertLat"))
            ))) <= u."alertRadiusKm"
        AND NOT EXISTS (
          SELECT 1 FROM "Notification" n
          WHERE n.recipient = u.id AND n.type = ${NOTIFICATION_TYPE.ANIMAL_NEARBY} AND n."entityId" = ${input.animalId}
        )
        AND (
          SELECT COUNT(*) FROM "Notification" n
          WHERE n.recipient = u.id AND n.type = ${NOTIFICATION_TYPE.ANIMAL_NEARBY} AND n."createdAt" >= ${since}
        ) < ${MAX_NEARBY_ALERTS_PER_DAY}
    `;
    if (rows instanceof Error) throw rows;

    const recipientIds = (rows as Array<{ id: string }>).map((row) => row.id);
    if (recipientIds.length === 0) return 0;

    const name = input.name?.trim() || "";
    const typeLabel = TYPE_LABEL[(input.type ?? "").toLowerCase()] ?? "";
    const who = name ? (typeLabel ? `${name} (${typeLabel})` : name) : typeLabel ? `Un ${typeLabel}` : "Una mascota";
    const where = input.place?.trim() ? ` en ${input.place.trim()}` : "";
    const lost = status === "lost";

    return await notify(context, {
      audience: recipientIds,
      product: "pet",
      type: NOTIFICATION_TYPE.ANIMAL_NEARBY,
      title: lost ? "Mascota perdida cerca de ti" : "Mascota encontrada cerca de ti",
      body: lost ? `${who} se perdió${where}. ¿La has visto?` : `${who} fue encontrado${where}. ¿Sabes de quién es?`,
      entityType: "Animal",
      entityId: input.animalId,
      url: input.url ?? null,
      metadata: { slug: input.slug ?? null, status },
    });
  } catch (error) {
    console.error("[alerts] No se pudo avisar a la zona:", input.animalId, error);
    return 0;
  }
}
