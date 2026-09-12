import { KeystoneContext } from "@keystone-6/core/types";
import { Role } from "../../../../models/Role/constants";
import {
  USER_AUTH_LOG_SOURCE,
  USER_AUTH_LOG_STEP,
} from "../../../../models/User/UserAuthLog/constants";
import { writeUserAuthLog } from "../../../../utils/auth/userAuthLogWrite";
import { attachUserToCompany } from "../../../../utils/access/attachUserToCompany";

const SIGNUP_ROLE_NAMES = [Role.VENDEDOR, Role.ADMIN_COMPANY] as const;

async function findSignupRoleIds(context: KeystoneContext): Promise<string[]> {
  const roles = (await context.sudo().query.Role.findMany({
    where: { name: { in: [...SIGNUP_ROLE_NAMES] } },
    query: "id name",
  })) as { id: string; name: string }[];
  return SIGNUP_ROLE_NAMES.map(
    (name) => roles.find((role) => role.name === name)?.id,
  ).filter((id): id is string => Boolean(id));
}

const typeDefs = ``;

const definition = `
  registerUser(data: UserCreateInput!, referrerCode: String, companyName: String): User
`;

const resolver = {
  registerUser: async (
    _root: unknown,
    {
      data,
      referrerCode,
      companyName,
    }: {
      data: Record<string, unknown>;
      referrerCode?: string | null;
      companyName?: string | null;
    },
    context: KeystoneContext,
  ) => {
    const startedAt = Date.now();
    const emailStr = String(data?.email ?? "").trim();
    const {
      company: _ignoredCompany,
      roles: _ignoredRoles,
      ...safeUserData
    } = data;

    let referredByConnect: { connect: { id: string } } | undefined;

    if (referrerCode) {
      const referrer = await context.sudo().query.User.findOne({
        where: { referralCode: referrerCode.toUpperCase() },
        query: "id",
      });

      if (!referrer) {
        await writeUserAuthLog(context, {
          startedAt,
          source: USER_AUTH_LOG_SOURCE.REGISTER_USER,
          step: USER_AUTH_LOG_STEP.REGISTER_FAIL_INVALID_REFERRER,
          success: false,
          message: "El código de referido no pertenece a ningún usuario.",
          email: emailStr,
          userId: null,
          responseSnapshot: {
            referrerCode: referrerCode.toUpperCase(),
          },
        });
        throw new Error("El código de referido no pertenece a ningún usuario.");
      }

      referredByConnect = { connect: { id: referrer.id } };
    }

    try {
      const trimmedCompanyName = companyName?.trim() ?? "";
      let companyId: string | undefined;

      if (trimmedCompanyName) {
        const company = (await context.sudo().query.SaasCompany.createOne({
          data: { name: trimmedCompanyName },
          query: "id",
        })) as { id: string };
        companyId = company.id;
      }

      const signupRoleIds = await findSignupRoleIds(context);
      if (signupRoleIds.length !== SIGNUP_ROLE_NAMES.length) {
        throw new Error(
          "No se pudieron asignar los roles de empresa. Contacta a soporte.",
        );
      }

      const user = await context.sudo().query.User.createOne({
        data: {
          ...safeUserData,
          referredBy: referredByConnect,
          roles: { connect: signupRoleIds.map((id) => ({ id })) },
        },
        query:
          "id name lastName secondLastName email phone username referralCode referredBy { id }",
      });

      if (companyId) {
        await attachUserToCompany(
          context,
          (user as { id: string }).id,
          companyId,
        );
        const workspaces = (await context.sudo().query.SaasWorkspace.findMany({
          where: { company: { id: { equals: companyId } } },
          take: 1,
          query: "id",
        })) as { id: string }[];
        const workspaceId = workspaces[0]?.id;
        if (workspaceId) {
          await context.sudo().query.SaasWorkspace.updateOne({
            where: { id: workspaceId },
            data: {
              members: { connect: [{ id: (user as { id: string }).id }] },
            },
          });
        }
      }

      await writeUserAuthLog(context, {
        startedAt,
        source: USER_AUTH_LOG_SOURCE.REGISTER_USER,
        step: USER_AUTH_LOG_STEP.REGISTER_SUCCESS,
        success: true,
        message: "Usuario registrado correctamente.",
        email: emailStr,
        userId: (user as { id: string }).id,
        responseSnapshot: {
          userId: (user as { id: string }).id,
          companyId: companyId ?? null,
          referrerCode: referrerCode
            ? String(referrerCode).toUpperCase()
            : null,
        },
      });

      return user;
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Error al registrar el usuario.";
      await writeUserAuthLog(context, {
        startedAt,
        source: USER_AUTH_LOG_SOURCE.REGISTER_USER,
        step: USER_AUTH_LOG_STEP.REGISTER_FAIL,
        success: false,
        message,
        email: emailStr,
        userId: null,
        responseSnapshot: {
          errorName: e instanceof Error ? e.name : "unknown",
        },
      });
      throw e;
    }
  },
};

export default { typeDefs, definition, resolver };
