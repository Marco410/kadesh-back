import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../../models/ActivityEvent/constants";
import { isPlatformAdmin } from "../../../../utils/access/tenant";
import { logActivity } from "../../../../utils/activity/logActivity";

/**
 * Operaciones → Kadesh Pet → Alertas de zona: un admin apaga o enciende las alertas de alguien,
 * mueve su zona o su radio, o le apaga los avisos por WhatsApp. Encender su WhatsApp no: a un
 * usuario Meta le exige que lo acepte él mismo (lo hace en /notificaciones). Queda en la actividad.
 * `AdminOpsActionResult` se declara en `companyOps.ts`.
 */

const typeDefs = `
  type Mutation {
    adminUpdateZoneAlerts(
      userId: ID!
      enabled: Boolean
      lat: Float
      lng: Float
      radiusKm: Int
      disableWhatsapp: Boolean
    ): AdminOpsActionResult!
  }
`;

const definition = `
  adminUpdateZoneAlerts(
    userId: ID!
    enabled: Boolean
    lat: Float
    lng: Float
    radiusKm: Int
    disableWhatsapp: Boolean
  ): AdminOpsActionResult!
`;

function result(success: boolean, message: string) {
  return { success, message };
}

type Args = {
  userId: string;
  enabled?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number | null;
  disableWhatsapp?: boolean | null;
};

const resolver = {
  adminUpdateZoneAlerts: async (_root: unknown, args: Args, context: KeystoneContext) => {
    if (!isPlatformAdmin(context.session)) return result(false, "Solo un administrador de Kadesh puede hacer esto.");
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    const user = await prisma.user.findUnique({
      where: { id: args.userId },
      select: {
        id: true,
        name: true,
        lastName: true,
        petAlertsEnabled: true,
        alertLat: true,
        alertLng: true,
        alertRadiusKm: true,
        whatsappNotifications: true,
      },
    });
    if (!user || user instanceof Error) return result(false, "No encontramos a esa persona.");

    const data: Record<string, unknown> = {};
    const hasPoint = args.lat != null || args.lng != null;
    if (hasPoint) {
      const lat = Number(args.lat);
      const lng = Number(args.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return result(false, "La zona no es válida: usa latitud y longitud, por ejemplo 19.7027, -101.1923.");
      }
      data.alertLat = lat;
      data.alertLng = lng;
    }
    if (args.radiusKm != null) {
      const radius = Math.round(Number(args.radiusKm));
      if (!Number.isFinite(radius) || radius < 1 || radius > 50) {
        return result(false, "El radio va de 1 a 50 km.");
      }
      data.alertRadiusKm = radius;
    }
    if (args.enabled != null) {
      const hasZone = (data.alertLat ?? user.alertLat) != null && (data.alertLng ?? user.alertLng) != null;
      if (args.enabled && !hasZone) return result(false, "Para encender las alertas, primero elige el centro de su zona.");
      data.petAlertsEnabled = args.enabled;
    }
    if (args.disableWhatsapp) data.whatsappNotifications = false;
    if (Object.keys(data).length === 0) return result(false, "No hay cambios que guardar.");

    const updated = await prisma.user.update({ where: { id: user.id }, data });
    if (updated instanceof Error) return result(false, "No se pudo guardar. Intenta de nuevo.");

    const name = [user.name, user.lastName].filter(Boolean).join(" ") || user.id;
    const changes: string[] = [];
    if ("petAlertsEnabled" in data && data.petAlertsEnabled !== user.petAlertsEnabled) {
      changes.push(data.petAlertsEnabled ? "encendió sus alertas" : "apagó sus alertas");
    }
    if (hasPoint) changes.push("movió su zona");
    if ("alertRadiusKm" in data && data.alertRadiusKm !== user.alertRadiusKm) changes.push(`radio a ${data.alertRadiusKm} km`);
    if (args.disableWhatsapp && user.whatsappNotifications) changes.push("apagó su WhatsApp");

    void logActivity(context, {
      type: ACTIVITY_EVENT.ADMIN_ZONE_ALERTS_UPDATED,
      entityType: "User",
      entityId: user.id,
      summary: `Alertas de zona de ${name}: ${changes.join(", ") || "sin cambios"}`,
      metadata: {
        before: {
          enabled: user.petAlertsEnabled,
          radiusKm: user.alertRadiusKm,
          whatsapp: user.whatsappNotifications,
        },
        after: data,
      },
    });
    return result(true, changes.length ? `Listo: ${changes.join(", ")}.` : "Guardado.");
  },
};

const adminZoneAlerts = { typeDefs, definition, resolver };
export default adminZoneAlerts;
