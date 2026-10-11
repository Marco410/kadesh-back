import { ListAccessControl } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../utils/access/tenant";

/** Notas internas de Kadesh sobre un cliente: solo el admin de plataforma las ve y las escribe. */
export const saasCompanyNoteAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isPlatformAdmin(session),
    create: ({ session }: any) => isPlatformAdmin(session),
    update: ({ session }: any) => isPlatformAdmin(session),
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
  filter: {
    query: ({ session }: any) => isPlatformAdmin(session),
    update: ({ session }: any) => isPlatformAdmin(session),
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
};
