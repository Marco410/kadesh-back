import { ListAccessControl } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../../utils/access/tenant";

/**
 * Historial de etapas: lo escribe el hook de `TechStatusBusinessLead` (con sudo), nadie por API.
 * Por ahora solo lo lee el admin de plataforma (velocidad comercial en Operaciones).
 */
export const techLeadStageChangeAccess: ListAccessControl<any> = {
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
