import { ListAccessControl } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../utils/access/tenant";

/**
 * Catálogo de paquetes de créditos.
 * Lectura pública (precios y recargas). Solo admin de plataforma crea/edita/borra:
 * `purchaseCredits` cobra con el `cost` y `creditsToAdd` de este registro.
 */
export const saasCreditAccess: ListAccessControl<any> = {
  operation: {
    query: () => true,
    create: ({ session }: any) => isPlatformAdmin(session),
    update: ({ session }: any) => isPlatformAdmin(session),
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
  filter: {
    query: () => true,
    update: ({ session }: any) => isPlatformAdmin(session),
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
};
