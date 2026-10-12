import { ListAccessControl } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../utils/access/tenant";

/** Solo el servidor escribe (latido de `trackEvents`). Lo lee el admin de plataforma. */
export const userActivityDayAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isPlatformAdmin(session),
    create: () => false,
    update: () => false,
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
  filter: {
    query: ({ session }: any) => isPlatformAdmin(session),
    update: () => false,
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
};
