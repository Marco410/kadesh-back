import { ListAccessControl } from "@keystone-6/core/types";
import { isPlatformAdmin, isSignedIn } from "../../utils/access/tenant";

/**
 * Catálogo de roles: se puede listar el nombre; users y mutaciones solo admin de plataforma.
 */
export const roleAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: ({ session }: any) => isPlatformAdmin(session),
    update: ({ session }: any) => isPlatformAdmin(session),
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
  filter: {
    query: ({ session }: any) => (isSignedIn(session) ? true : false),
    update: ({ session }: any) => (isPlatformAdmin(session) ? true : false),
    delete: ({ session }: any) => (isPlatformAdmin(session) ? true : false),
  },
};

export const roleUsersFieldAccess = {
  read: ({ session }: any) => isPlatformAdmin(session),
  create: ({ session }: any) => isPlatformAdmin(session),
  update: ({ session }: any) => isPlatformAdmin(session),
};
