import type { KeystoneContext } from "@keystone-6/core/types";
import {
  NOTIFICATION_TYPE,
  PUSH_DELIVERY,
  WHATSAPP_DELIVERY,
} from "../../../../models/Notification/constants";
import { wantsWhatsappType } from "../../../../models/User/whatsappPrefs";
import {
  findZoneAlertCandidates,
  MAX_NEARBY_ALERTS_PER_DAY,
} from "../../../../utils/notifications/nearbyAnimalAlerts";
import { adminPrisma, assertPlatformAdmin, clampInt, daysAgo, insensitive, personRef, toIso } from "./shared";

/**
 * Operaciones → Kadesh Pet → Avisos y Alertas de zona. Solo admin de plataforma.
 * - `adminNotificationLog`: cada aviso (una fila por destinatario) con a dónde se fue: campana
 *   (leída o no), push (dispositivos) y WhatsApp (omitido y por qué, aceptado, entregado, leído,
 *   falló). Lo escriben `notify`, `push.ts`, `whatsapp.ts` y el webhook de WhatsApp.
 * - `adminZoneAlerts`: quién tiene alertas de zona, dónde, por qué canales le llegan y cuántas
 *   recibió.
 * - `adminZoneAlertPreview`: quién recibiría una alerta en un punto (no manda nada).
 * Las acciones sobre las alertas de alguien están en `mutations/admin/zoneAlerts.ts`.
 */

const typeDefs = `
  type AdminNotificationRow {
    id: ID!
    createdAt: String
    product: String
    type: String!
    title: String!
    body: String
    url: String
    entityType: String
    entityId: String
    readAt: String
    recipient: AdminPersonRef
    recipientPhone: String
    pushStatus: String
    pushDevices: Int
    whatsappStatus: String
    whatsappDetail: String
    whatsappUpdatedAt: String
  }

  type AdminNotificationSummary {
    total: Int!
    read: Int!
    pushSent: Int!
    pushFailed: Int!
    pushNoDevices: Int!
    whatsappDelivered: Int!
    whatsappPending: Int!
    whatsappFailed: Int!
    whatsappSkipped: Int!
  }

  type AdminNotificationLog {
    items: [AdminNotificationRow!]!
    total: Int!
    summary: AdminNotificationSummary!
    types: [AdminCount!]!
  }

  type AdminZoneAlertRow {
    id: ID!
    name: String!
    lastName: String
    email: String
    phone: String
    enabled: Boolean!
    lat: Float
    lng: Float
    radiusKm: Int
    """on, off (no lo activó), no_phone (sin teléfono) o muted (silenció las alertas de zona)."""
    whatsapp: String!
    pushDevices: Int!
    alerts30d: Int!
    lastAlertAt: String
  }

  type AdminZoneAlertSummary {
    active: Int!
    inactive: Int!
    withPush: Int!
    withWhatsapp: Int!
    alerts7d: Int!
  }

  type AdminZoneAlerts {
    items: [AdminZoneAlertRow!]!
    total: Int!
    summary: AdminZoneAlertSummary!
  }

  type AdminZonePreviewRow {
    id: ID!
    name: String!
    lastName: String
    email: String
    distanceKm: Float!
    radiusKm: Int
    alertsToday: Int!
    """Llegó al tope del día: hoy ya no recibiría la alerta."""
    capped: Boolean!
    pushDevices: Int!
    whatsapp: String!
  }

  type AdminZonePreview {
    items: [AdminZonePreviewRow!]!
    total: Int!
    wouldReceive: Int!
    capped: Int!
    maxPerDay: Int!
  }
`;

const definition = `
  adminNotificationLog(
    product: String
    type: String
    channel: String
    result: String
    search: String
    entityId: String
    days: Int
    take: Int
    skip: Int
  ): AdminNotificationLog!
  adminZoneAlerts(search: String, status: String, take: Int, skip: Int): AdminZoneAlerts!
  adminZoneAlertPreview(lat: Float!, lng: Float!): AdminZonePreview!
`;

const PUSH_OK = [PUSH_DELIVERY.SENT, PUSH_DELIVERY.PARTIAL];
const WHATSAPP_OK = [WHATSAPP_DELIVERY.SENT, WHATSAPP_DELIVERY.DELIVERED, WHATSAPP_DELIVERY.READ];

/**
 * Canal (`push` / `whatsapp` / todos) × resultado (`delivered` / `failed` / `skipped` / todos).
 * «Entregado» en WhatsApp incluye «aceptado por Meta» mientras llega el acuse.
 */
function channelWhere(channel: string, result: string) {
  const push = {
    delivered: { pushStatus: { in: PUSH_OK } },
    failed: { pushStatus: PUSH_DELIVERY.FAILED },
    skipped: { pushStatus: PUSH_DELIVERY.NO_DEVICES },
    all: { pushStatus: { not: null } },
  } as Record<string, object>;
  const whatsapp = {
    delivered: { whatsappStatus: { in: [WHATSAPP_DELIVERY.ACCEPTED, ...WHATSAPP_OK] } },
    failed: { whatsappStatus: WHATSAPP_DELIVERY.FAILED },
    skipped: { whatsappStatus: WHATSAPP_DELIVERY.SKIPPED },
    all: { whatsappStatus: { not: null } },
  } as Record<string, object>;
  const key = result in push ? result : "all";
  if (channel === "push") return push[key];
  if (channel === "whatsapp") return whatsapp[key];
  if (key === "all") return {};
  return { OR: [push[key], whatsapp[key]] };
}

function personSearch(search: string | null | undefined) {
  const q = search?.trim();
  if (!q) return null;
  return {
    OR: [
      { name: insensitive(q) },
      { lastName: insensitive(q) },
      { email: insensitive(q) },
      { phone: { contains: q.replace(/\D/g, "") || q } },
    ],
  };
}

/** Estado de WhatsApp de una persona para las alertas de zona. */
function whatsappState(user: { whatsappNotifications?: boolean | null; phone?: string | null; whatsappMutedTypes?: unknown }) {
  if (!user.whatsappNotifications) return "off";
  if (!user.phone?.trim()) return "no_phone";
  if (!wantsWhatsappType(user.whatsappMutedTypes, NOTIFICATION_TYPE.ANIMAL_NEARBY)) return "muted";
  return "on";
}

/** Dispositivos con push por persona. */
async function pushDevicesByUser(prisma: any, userIds: string[]): Promise<Map<string, number>> {
  if (!userIds.length) return new Map();
  const rows = await prisma.tokenNotification.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _count: { _all: true },
  });
  if (rows instanceof Error) throw rows;
  return new Map((rows as Array<{ userId: string; _count: { _all: number } }>).map((row) => [row.userId, row._count._all]));
}

function countBy(rows: unknown, key: string): Map<string | null, number> {
  if (rows instanceof Error) throw rows;
  return new Map((rows as Array<Record<string, any>>).map((row) => [row[key] ?? null, row._count._all]));
}

const ZONE_SET = { alertLat: { not: null }, alertLng: { not: null } };
const ACTIVE = { petAlertsEnabled: true, ...ZONE_SET };

const USER_SELECT = {
  id: true,
  name: true,
  lastName: true,
  email: true,
  phone: true,
  petAlertsEnabled: true,
  alertLat: true,
  alertLng: true,
  alertRadiusKm: true,
  whatsappNotifications: true,
  whatsappMutedTypes: true,
} as const;

const resolver = {
  adminNotificationLog: async (
    _root: unknown,
    args: {
      product?: string | null;
      type?: string | null;
      channel?: string | null;
      result?: string | null;
      search?: string | null;
      entityId?: string | null;
      days?: number | null;
      take?: number | null;
      skip?: number | null;
    },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const days = clampInt(args.days, 1, 365, 7);
    const take = clampInt(args.take, 1, 100, 25);
    const skip = clampInt(args.skip, 0, 1_000_000, 0);
    const recipient = personSearch(args.search);

    // Base: lo que no es el filtro de canal ni de tipo (las cifras y la lista de tipos salen de aquí).
    const base: Record<string, unknown> = {
      createdAt: { gte: daysAgo(days) },
      ...(args.product?.trim() ? { product: args.product.trim() } : {}),
      ...(args.entityId?.trim() ? { entityId: args.entityId.trim() } : {}),
      ...(recipient ? { recipient } : {}),
    };
    const withType = { ...base, ...(args.type?.trim() ? { type: args.type.trim() } : {}) };
    const where = { AND: [withType, channelWhere(args.channel?.trim() || "", args.result?.trim() || "")] };

    const [total, rows, read, byPush, byWhatsapp, byType] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take,
        skip,
        include: { recipient: { select: { id: true, name: true, lastName: true, email: true, phone: true } } },
      }),
      prisma.notification.count({ where: { ...withType, readAt: { not: null } } }),
      prisma.notification.groupBy({ by: ["pushStatus"], where: withType, _count: { _all: true } }),
      prisma.notification.groupBy({ by: ["whatsappStatus"], where: withType, _count: { _all: true } }),
      prisma.notification.groupBy({ by: ["type"], where: base, _count: { _all: true } }),
    ]);
    for (const value of [total, rows, read]) if (value instanceof Error) throw value;

    const push = countBy(byPush, "pushStatus");
    const whatsapp = countBy(byWhatsapp, "whatsappStatus");
    const sum = (map: Map<string | null, number>, keys: string[]) =>
      keys.reduce((acc, key) => acc + (map.get(key) ?? 0), 0);
    const types = countBy(byType, "type");

    return {
      total,
      items: (rows as any[]).map((row) => ({
        id: row.id,
        createdAt: toIso(row.createdAt),
        product: row.product,
        type: row.type,
        title: row.title,
        body: row.body || null,
        url: row.url || null,
        entityType: row.entityType || null,
        entityId: row.entityId || null,
        readAt: toIso(row.readAt),
        recipient: personRef(row.recipient),
        recipientPhone: row.recipient?.phone || null,
        pushStatus: row.pushStatus ?? null,
        pushDevices: row.pushDevices ?? null,
        whatsappStatus: row.whatsappStatus ?? null,
        whatsappDetail: row.whatsappDetail || null,
        whatsappUpdatedAt: toIso(row.whatsappUpdatedAt),
      })),
      summary: {
        total: [...push.values()].reduce((acc, count) => acc + count, 0),
        read,
        pushSent: sum(push, PUSH_OK),
        pushFailed: sum(push, [PUSH_DELIVERY.FAILED]),
        pushNoDevices: sum(push, [PUSH_DELIVERY.NO_DEVICES]),
        whatsappDelivered: sum(whatsapp, WHATSAPP_OK),
        whatsappPending: sum(whatsapp, [WHATSAPP_DELIVERY.ACCEPTED]),
        whatsappFailed: sum(whatsapp, [WHATSAPP_DELIVERY.FAILED]),
        whatsappSkipped: sum(whatsapp, [WHATSAPP_DELIVERY.SKIPPED]),
      },
      types: [...types.entries()]
        .filter(([key]) => key)
        .map(([key, count]) => ({ key: key as string, count }))
        .sort((a, b) => b.count - a.count),
    };
  },

  adminZoneAlerts: async (
    _root: unknown,
    args: { search?: string | null; status?: string | null; take?: number | null; skip?: number | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const prisma = adminPrisma(context);
    const take = clampInt(args.take, 1, 100, 25);
    const skip = clampInt(args.skip, 0, 1_000_000, 0);
    const search = personSearch(args.search);

    // Quien alguna vez eligió zona o tiene las alertas encendidas. Activas = encendidas y con zona.
    const everyone = { OR: [{ petAlertsEnabled: true }, ZONE_SET] };
    const status = args.status?.trim() || "all";
    const statusWhere =
      status === "active" ? ACTIVE : status === "inactive" ? { NOT: ACTIVE } : {};
    const where = { AND: [everyone, statusWhere, ...(search ? [search] : [])] };

    const [total, users, active, inactive, activeUsers, alerts7d] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, orderBy: [{ createdAt: "desc" }], take, skip, select: USER_SELECT }),
      prisma.user.count({ where: ACTIVE }),
      prisma.user.count({ where: { AND: [everyone, { NOT: ACTIVE }] } }),
      prisma.user.findMany({
        where: ACTIVE,
        select: { id: true, phone: true, whatsappNotifications: true, whatsappMutedTypes: true },
      }),
      prisma.notification.count({
        where: { type: NOTIFICATION_TYPE.ANIMAL_NEARBY, createdAt: { gte: daysAgo(7) } },
      }),
    ]);
    for (const value of [total, users, active, inactive, activeUsers, alerts7d]) if (value instanceof Error) throw value;

    const pageIds = (users as Array<{ id: string }>).map((user) => user.id);
    const activeIds = (activeUsers as Array<{ id: string }>).map((user) => user.id);
    const [pagePush, activePush, received] = await Promise.all([
      pushDevicesByUser(prisma, pageIds),
      pushDevicesByUser(prisma, activeIds),
      pageIds.length
        ? prisma.notification.groupBy({
            by: ["recipientId"],
            where: {
              recipientId: { in: pageIds },
              type: NOTIFICATION_TYPE.ANIMAL_NEARBY,
              createdAt: { gte: daysAgo(30) },
            },
            _count: { _all: true },
            _max: { createdAt: true },
          })
        : [],
    ]);
    if (received instanceof Error) throw received;
    const receivedBy = new Map(
      (received as Array<{ recipientId: string; _count: { _all: number }; _max: { createdAt: Date | null } }>).map(
        (row) => [row.recipientId, row],
      ),
    );

    return {
      total,
      items: (users as any[]).map((user) => ({
        id: user.id,
        name: user.name ?? "",
        lastName: user.lastName ?? null,
        email: user.email ?? null,
        phone: user.phone || null,
        enabled: Boolean(user.petAlertsEnabled && user.alertLat != null && user.alertLng != null),
        lat: user.alertLat ?? null,
        lng: user.alertLng ?? null,
        radiusKm: user.alertRadiusKm ?? null,
        whatsapp: whatsappState(user),
        pushDevices: pagePush.get(user.id) ?? 0,
        alerts30d: receivedBy.get(user.id)?._count._all ?? 0,
        lastAlertAt: toIso(receivedBy.get(user.id)?._max.createdAt ?? null),
      })),
      summary: {
        active,
        inactive,
        withPush: activeIds.filter((id) => (activePush.get(id) ?? 0) > 0).length,
        withWhatsapp: (activeUsers as any[]).filter((user) => whatsappState(user) === "on").length,
        alerts7d,
      },
    };
  },

  adminZoneAlertPreview: async (
    _root: unknown,
    { lat, lng }: { lat: number; lng: number },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new Error("Ese punto no es válido. Usa latitud y longitud, por ejemplo 19.7027, -101.1923.");
    }
    const prisma = adminPrisma(context);
    const candidates = await findZoneAlertCandidates(prisma, { lat, lng });
    const shown = candidates.slice(0, 200);
    const ids = shown.map((row) => row.id);
    const [users, push] = await Promise.all([
      ids.length ? prisma.user.findMany({ where: { id: { in: ids } }, select: USER_SELECT }) : [],
      pushDevicesByUser(prisma, ids),
    ]);
    if (users instanceof Error) throw users;
    const userBy = new Map((users as any[]).map((user) => [user.id, user]));
    const capped = candidates.filter((row) => row.alertsToday >= MAX_NEARBY_ALERTS_PER_DAY).length;

    return {
      total: candidates.length,
      wouldReceive: candidates.length - capped,
      capped,
      maxPerDay: MAX_NEARBY_ALERTS_PER_DAY,
      items: shown.map((row) => {
        const user = userBy.get(row.id) ?? {};
        return {
          id: row.id,
          name: user.name ?? "",
          lastName: user.lastName ?? null,
          email: user.email ?? null,
          distanceKm: Math.round(row.distanceKm * 10) / 10,
          radiusKm: user.alertRadiusKm ?? null,
          alertsToday: row.alertsToday,
          capped: row.alertsToday >= MAX_NEARBY_ALERTS_PER_DAY,
          pushDevices: push.get(row.id) ?? 0,
          whatsapp: whatsappState(user),
        };
      }),
    };
  },
};

const adminNotifications = { typeDefs, definition, resolver };
export default adminNotifications;
