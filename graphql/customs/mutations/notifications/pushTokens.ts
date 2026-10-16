import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId } from "../../../../utils/access/tenant";
import { PUSH_PLATFORM, type PushPlatform } from "../../../../models/TokenNotification/constants";

const typeDefs = `
  type Mutation {
    registerPushToken(token: String!, platform: String!, deviceId: String): Boolean!
    unregisterPushToken(token: String!): Boolean!
  }
`;

const definition = `
  registerPushToken(token: String!, platform: String!, deviceId: String): Boolean!
  unregisterPushToken(token: String!): Boolean!
`;

const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]{1,200}\]$/;
const PLATFORMS = new Set<string>(Object.values(PUSH_PLATFORM));

function prismaOf(context: KeystoneContext) {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}

/** Prisma de Keystone devuelve el error en vez de lanzarlo. */
function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return value;
}

const resolver = {
  /**
   * Guarda (o actualiza) el token push de este dispositivo para quien tiene la sesión. Un token es
   * de un solo dispositivo: si estaba con otra cuenta (cambio de sesión en el mismo teléfono), pasa
   * a esta. Si el dispositivo ya tenía otro token de esta cuenta (Expo lo rotó), el viejo se borra.
   */
  registerPushToken: async (
    _root: unknown,
    { token, platform, deviceId }: { token: string; platform: string; deviceId?: string | null },
    context: KeystoneContext,
  ): Promise<boolean> => {
    const userId = getSessionUserId(context.session as any);
    if (!userId) throw new Error("Inicia sesión para activar las notificaciones.");
    const cleanToken = token.trim();
    if (!EXPO_TOKEN_RE.test(cleanToken)) throw new Error("Token de notificaciones no válido.");
    if (!PLATFORMS.has(platform)) throw new Error("Plataforma no válida.");
    const cleanDevice = deviceId?.trim().slice(0, 200) || null;

    const prisma = prismaOf(context);
    const existing = unwrap<Array<{ id: string }>>(
      await prisma.tokenNotification.findMany({ where: { token: cleanToken }, select: { id: true } }),
    );
    const data = {
      token: cleanToken,
      userId,
      platform: platform as PushPlatform,
      deviceId: cleanDevice,
      lastSeenAt: new Date(),
    };

    const [keep, ...duplicates] = existing;
    if (keep) {
      unwrap(await prisma.tokenNotification.update({ where: { id: keep.id }, data }));
      if (duplicates.length) {
        unwrap(await prisma.tokenNotification.deleteMany({ where: { id: { in: duplicates.map((row) => row.id) } } }));
      }
    } else {
      unwrap(await prisma.tokenNotification.create({ data }));
    }

    if (cleanDevice) {
      unwrap(
        await prisma.tokenNotification.deleteMany({
          where: { userId, deviceId: cleanDevice, token: { not: cleanToken } },
        }),
      );
    }
    return true;
  },

  /** Quita el token de este dispositivo (al cerrar sesión). Solo borra los de quien tiene la sesión. */
  unregisterPushToken: async (
    _root: unknown,
    { token }: { token: string },
    context: KeystoneContext,
  ): Promise<boolean> => {
    const userId = getSessionUserId(context.session as any);
    if (!userId) return false;
    const result = unwrap<{ count: number }>(
      await prismaOf(context).tokenNotification.deleteMany({ where: { token: token.trim(), userId } }),
    );
    return result.count > 0;
  },
};

export default { typeDefs, definition, resolver };
