import { relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { list } from "@keystone-6/core";
import { isPlatformAdmin } from "../../utils/access/tenant";
import { PUSH_PLATFORM_OPTIONS } from "./constants";

const adminOnly = ({ session }: { session?: unknown }) => isPlatformAdmin(session as any);

/**
 * Token push (Expo) de un dispositivo. La app lo registra y lo quita con las mutaciones
 * `registerPushToken` / `unregisterPushToken` (sudo); por la API generada solo lo ven los admins:
 * un token permite mandarle notificaciones a esa persona.
 */
export default list({
  access: {
    operation: {
      query: adminOnly,
      create: adminOnly,
      update: adminOnly,
      delete: adminOnly,
    },
  },
  fields: {
    token: text({
      isIndexed: true,
      ui: {
        displayMode: "textarea",
      },
    }),
    user: relationship({
      ref: "User",
      many: false,
    }),
    platform: select({
      type: "string",
      options: PUSH_PLATFORM_OPTIONS,
      db: { isNullable: true },
    }),
    deviceId: text({ db: { isNullable: true } }),
    lastSeenAt: timestamp({
      db: { isNullable: true },
      ui: { itemView: { fieldMode: "read" } },
    }),
  },
});
