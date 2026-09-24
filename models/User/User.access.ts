import { ListAccessControl } from "@keystone-6/core/types";
import { hasRole } from "../../auth/permissions";
import { Role } from "../Role/constants";
import {
  getSessionCompanyId,
  getSessionUserId,
  isCompanyAdmin,
  isPlatformAdmin,
  isSignedIn,
} from "../../utils/access/tenant";

function userVisibleWhere(
  session: any,
): true | false | Record<string, unknown> {
  if (isPlatformAdmin(session)) return true;

  const userId = getSessionUserId(session);
  if (!userId) return false;

  if (hasRole(session, [Role.ADMIN_COMPANY])) {
    const companyId = getSessionCompanyId(session);
    if (!companyId) return { id: { equals: userId } };
    return {
      OR: [
        { id: { equals: userId } },
        { company: { id: { equals: companyId } } },
      ],
    };
  }

  return {
    OR: [
      { id: { equals: userId } },
      {
        my_appointments: {
          some: {
            pet_place: {
              user: { id: { equals: userId } },
              verified: { equals: true },
            },
          },
        },
      },
      {
        clinic_patients_of: {
          some: {
            user: { id: { equals: userId } },
            verified: { equals: true },
          },
        },
      },
    ],
  };
}

function isSelf(session: any, item: { id?: string } | undefined) {
  const userId = getSessionUserId(session);
  return !!userId && item?.id === userId;
}

const userAccess: ListAccessControl<any> = {
  operation: {
    query: ({ session }: any) => isSignedIn(session),
    create: () => true,
    update: ({ session }: any) => isSignedIn(session),
    delete: ({ session }: any) => isPlatformAdmin(session),
  },
  filter: {
    query: ({ session }: any) => userVisibleWhere(session),
    update: ({ session }: any) => userVisibleWhere(session),
    delete: ({ session }: any) => (isPlatformAdmin(session) ? true : false),
  },
};

export const userRolesFieldAccess = {
  read: ({ session }: any) => isSignedIn(session),
  create: ({ session }: any) =>
    isPlatformAdmin(session) || isCompanyAdmin(session),
  update: ({ session }: any) =>
    isPlatformAdmin(session) || isCompanyAdmin(session),
};

export const userOnboardingFieldAccess = {
  read: ({ session, item }: any) =>
    isPlatformAdmin(session) || isSelf(session, item),
  create: () => true,
  update: ({ session, item }: any) =>
    isPlatformAdmin(session) || isSelf(session, item),
};

function companyConnectId(inputData: any): string | null {
  const connect = inputData?.company?.connect;
  if (!connect) return null;
  if (typeof connect.id === "string") return connect.id;
  if (Array.isArray(connect) && typeof connect[0]?.id === "string") {
    return connect[0].id;
  }
  return null;
}

export const userCompanyFieldAccess = {
  read: ({ session }: any) => isSignedIn(session),
  create: ({ session }: any) =>
    isPlatformAdmin(session) || isCompanyAdmin(session),
  update: async ({ session, item, inputData, context }: any) => {
    if (isPlatformAdmin(session)) return true;
    if (!isSelf(session, item)) return false;

    const connectId = companyConnectId(inputData);
    if (!connectId) return false;
    if (item.companyId === connectId) return true;
    if (item.companyId) return false;

    const company = (await context.sudo().query.SaasCompany.findOne({
      where: { id: connectId },
      query: "id users { id }",
    })) as { id: string; users?: { id: string }[] } | null;
    if (!company) return false;
    const others = (company.users ?? []).filter((u) => u.id !== item.id);
    return others.length === 0;
  },
};

export const userSecretFieldAccess = {
  read: ({ session, item }: any) =>
    isPlatformAdmin(session) || isSelf(session, item),
  create: () => true,
  update: ({ session, item }: any) =>
    isPlatformAdmin(session) || isSelf(session, item),
};

export const userStripeFieldAccess = {
  read: ({ session }: any) => isPlatformAdmin(session),
  create: () => true,
  update: () => false,
};

export default userAccess;
