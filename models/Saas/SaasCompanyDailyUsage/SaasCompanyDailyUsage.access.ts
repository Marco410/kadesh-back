import { ListAccessControl } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../utils/access/tenant";

/** Resumen diario de uso: lo escribe el cron (`rollupDailyUsage`), lo lee el admin de plataforma. */
export const saasCompanyDailyUsageAccess: ListAccessControl<any> = {
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
