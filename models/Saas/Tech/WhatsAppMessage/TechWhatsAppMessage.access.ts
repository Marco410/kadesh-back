import { ListAccessControl } from "@keystone-6/core/types";
import { whatsappMessageScopedWhere } from "../../../../utils/access/leadScopedFilter";
import { isPlatformAdmin, isSignedIn } from "../../../../utils/access/tenant";

/**
 * Historial de WhatsApp: lectura acotada al lead (mismo criterio que TechStatusBusinessLead).
 * Altas solo vía sudo (sendWhatsAppMessage / webhook entrante). Borrado solo admin de plataforma.
 */
export const techWhatsAppMessageAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: () => false,
    update: () => false,
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
  filter: {
    query: ({ session }: any) => whatsappMessageScopedWhere(session),
    delete: ({ session }: any) => (isPlatformAdmin(session) ? true : false),
  },
};
