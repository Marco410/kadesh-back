import type { KeystoneContext } from "@keystone-6/core/types";
import { NOTIFICATION_TYPE } from "../../models/Notification/constants";
import { notify } from "./notify";
import { petSiteUrl } from "./whatsapp";

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

export type ZoneAlertCandidate = {
  id: string;
  /** Distancia del punto al centro de su zona, en km. */
  distanceKm: number;
  /** Alertas de zona que recibió en las últimas 24 h (tope: MAX_NEARBY_ALERTS_PER_DAY). */
  alertsToday: number;
  /** Ya recibió la alerta de este animal (solo con `animalId`). */
  alreadyAlerted: boolean;
};

/**
 * Personas con alertas activas cuya zona incluye el punto, de la más cercana a la más lejana. Sin
 * cuentas suspendidas o anonimizadas ni `excludeUserId`. No aplica el tope del día ni «ya avisado»:
 * eso lo decide quien llama (la alerta real los salta; la vista previa de Operaciones los muestra).
 * Distancia con haversine en SQL.
 */
export async function findZoneAlertCandidates(
  prisma: any,
  { lat, lng, excludeUserId = "", animalId = "" }: { lat: number; lng: number; excludeUserId?: string; animalId?: string },
): Promise<ZoneAlertCandidate[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw`
    SELECT u.id,
      d.km AS "distanceKm",
      (SELECT COUNT(*)::int FROM "Notification" n
        WHERE n.recipient = u.id AND n.type = ${NOTIFICATION_TYPE.ANIMAL_NEARBY} AND n."createdAt" >= ${since}) AS "alertsToday",
      EXISTS (SELECT 1 FROM "Notification" n
        WHERE n.recipient = u.id AND n.type = ${NOTIFICATION_TYPE.ANIMAL_NEARBY} AND n."entityId" = ${animalId}
          AND ${animalId} <> '') AS "alreadyAlerted"
    FROM "User" u
    CROSS JOIN LATERAL (
      SELECT 6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(${lat})) * cos(radians(u."alertLat")) * cos(radians(u."alertLng") - radians(${lng}))
        + sin(radians(${lat})) * sin(radians(u."alertLat"))
      ))) AS km
    ) d
    WHERE u."petAlertsEnabled" = true
      AND u."alertLat" IS NOT NULL
      AND u."alertLng" IS NOT NULL
      AND u."suspendedAt" IS NULL
      AND u."anonymizedAt" IS NULL
      AND u.id <> ${excludeUserId}
      AND d.km <= u."alertRadiusKm"
    ORDER BY d.km ASC
  `;
  // Prisma de Keystone devuelve el error en vez de lanzarlo.
  if (rows instanceof Error) throw rows;
  return (rows as Array<{ id: string; distanceKm: number; alertsToday: number; alreadyAlerted: boolean }>).map((row) => ({
    id: row.id,
    distanceKm: Number(row.distanceKm),
    alertsToday: Number(row.alertsToday),
    alreadyAlerted: Boolean(row.alreadyAlerted),
  }));
}

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
    const candidates = await findZoneAlertCandidates(prisma, {
      lat: input.lat,
      lng: input.lng,
      excludeUserId: input.ownerId ?? "",
      animalId: input.animalId,
    });
    // Ni a quien ya recibió la alerta de este animal, ni a quien llegó al tope del día.
    const recipientIds = candidates
      .filter((row) => !row.alreadyAlerted && row.alertsToday < MAX_NEARBY_ALERTS_PER_DAY)
      .map((row) => row.id);
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
      // kadesh_pet_animal_cerca: «reportaron un animal {status} cerca de ti. Es {animal}. … {url}».
      templateValues: {
        status: lost ? "perdido" : "encontrado",
        animal: `${name ? who : who.charAt(0).toLowerCase() + who.slice(1)}${where}`,
        url: input.url ?? petSiteUrl(),
      },
    });
  } catch (error) {
    console.error("[alerts] No se pudo avisar a la zona:", input.animalId, error);
    return 0;
  }
}
