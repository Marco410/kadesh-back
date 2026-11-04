import { NOTIFICATION_TYPE } from "../Notification/constants";

const KNOWN_TYPES = new Set<string>(Object.values(NOTIFICATION_TYPE));

/**
 * `User.whatsappMutedTypes`: tipos de aviso (`NOTIFICATION_TYPE`) que la persona NO quiere por
 * WhatsApp. Con `whatsappNotifications` activo le llegan todos los demás; vacío = todos. Se guarda
 * lo apagado (no lo encendido) para que un tipo nuevo con plantilla llegue sin pedir nada más.
 * Lo edita la propia persona en /notificaciones de la web (y en la app).
 */
export const whatsappMutedTypesHooks = {
  resolveInput: async ({ resolvedData, fieldKey }: any) => {
    const value = resolvedData[fieldKey];
    if (!Array.isArray(value)) return value;
    return [...new Set(value.filter((type: unknown) => typeof type === "string"))];
  },
  validateInput: async ({ resolvedData, addValidationError, fieldKey }: any) => {
    const value = resolvedData[fieldKey];
    if (value === undefined || value === null) return;
    if (!Array.isArray(value) || value.some((type: unknown) => typeof type !== "string" || !KNOWN_TYPES.has(type))) {
      addValidationError("Los avisos de WhatsApp a silenciar deben ser una lista de tipos de aviso conocidos.");
    }
  },
};

/** ¿Quiere este tipo por WhatsApp? `whatsappMutedTypes` llega de Prisma como JSON (puede no ser lista). */
export function wantsWhatsappType(mutedTypes: unknown, type: string): boolean {
  return !(Array.isArray(mutedTypes) && mutedTypes.includes(type));
}
