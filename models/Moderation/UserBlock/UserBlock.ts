import { list } from "@keystone-6/core";
import { relationship, timestamp } from "@keystone-6/core/fields";
import { getSessionUserId, isPlatformAdmin } from "../../../utils/access/tenant";

/**
 * Una persona bloqueó a otra: deja de ver sus comentarios en la app. Se crea y se quita con
 * `blockUser` / `unblockUser`; cada quien solo ve sus propios bloqueos.
 */
export default list({
  access: {
    operation: {
      query: ({ session }) => !!getSessionUserId(session as any),
      create: () => false,
      update: () => false,
      delete: ({ session }) => isPlatformAdmin(session as any),
    },
    filter: {
      query: ({ session }) => {
        if (isPlatformAdmin(session as any)) return true;
        const userId = getSessionUserId(session as any);
        return userId ? { blocker: { id: { equals: userId } } } : false;
      },
    },
  },
  fields: {
    blocker: relationship({ ref: "User", many: false }),
    blocked: relationship({ ref: "User", many: false }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
  },
});
