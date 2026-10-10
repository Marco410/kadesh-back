import type { GraphQLFieldResolver, GraphQLSchema } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import { writeUserAuthLog } from "../../../../utils/auth/userAuthLogWrite";
import {
  USER_AUTH_LOG_SOURCE,
  USER_AUTH_LOG_STEP,
} from "../../../../models/User/UserAuthLog/constants";

const FIELD = "authenticateUserWithPassword";

type PasswordAuthArgs = { email?: string; password?: string };

function resultUserId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const item = (result as { item?: { id?: unknown } }).item;
  return typeof item?.id === "string" ? item.id : null;
}

function isSuccess(result: unknown): boolean {
  return Boolean(
    result &&
      typeof result === "object" &&
      typeof (result as { sessionToken?: unknown }).sessionToken === "string",
  );
}

/** Liga el intento fallido a la cuenta si existe: es el historial de accesos de esa persona. */
async function findUserIdByEmail(
  context: KeystoneContext,
  email: string,
): Promise<string | null> {
  if (!email) return null;
  try {
    const user = (await context.sudo().query.User.findOne({
      where: { email },
      query: "id",
    })) as { id: string } | null;
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function touchLastLogin(context: KeystoneContext, userId: string) {
  try {
    await context.sudo().query.User.updateOne({
      where: { id: userId },
      data: { lastLoginAt: new Date().toISOString() },
      query: "id",
    });
  } catch {
    // El login no falla por no poder marcar el último acceso.
  }
}

/**
 * Envuelve `authenticateUserWithPassword` (generado por @keystone-6/auth) para registrar
 * el acceso en el servidor: `UserAuthLog` (éxito o fallo) y `User.lastLoginAt`.
 * Antes lo escribía el front con un `createUserAuthLog` abierto, y cualquiera podía falsificarlo.
 * Nunca guarda la contraseña ni el token de sesión.
 */
export function passwordLoginAuditResolvers(
  baseSchema: GraphQLSchema,
): Record<string, GraphQLFieldResolver<unknown, KeystoneContext, PasswordAuthArgs>> {
  const original = baseSchema.getMutationType()?.getFields()[FIELD]?.resolve as
    | GraphQLFieldResolver<unknown, KeystoneContext, PasswordAuthArgs>
    | undefined;
  if (!original) return {};

  const wrapped: GraphQLFieldResolver<
    unknown,
    KeystoneContext,
    PasswordAuthArgs
  > = async (root, args, context, info) => {
    const startedAt = Date.now();
    const email = typeof args?.email === "string" ? args.email.trim() : "";

    let result: unknown;
    try {
      result = await original(root, args, context, info);
    } catch (error) {
      await writeUserAuthLog(context, {
        startedAt,
        source: USER_AUTH_LOG_SOURCE.CUSTOM_AUTH,
        step: USER_AUTH_LOG_STEP.CUSTOM_AUTH_FAIL,
        success: false,
        message: "Error del servidor al iniciar sesión con contraseña.",
        email,
        userId: await findUserIdByEmail(context, email),
        responseSnapshot: { method: "password", reason: "server_error" },
      });
      throw error;
    }

    const success = isSuccess(result);
    const userId = success
      ? resultUserId(result)
      : await findUserIdByEmail(context, email);

    if (success && userId) {
      await touchLastLogin(context, userId);
    }

    await writeUserAuthLog(context, {
      startedAt,
      source: USER_AUTH_LOG_SOURCE.CUSTOM_AUTH,
      step: success
        ? USER_AUTH_LOG_STEP.CUSTOM_AUTH_LOGIN
        : USER_AUTH_LOG_STEP.CUSTOM_AUTH_FAIL,
      success,
      message: success
        ? "Inicio de sesión con contraseña correcto."
        : "Correo o contraseña incorrectos.",
      email,
      userId,
      responseSnapshot: success
        ? { method: "password", userId }
        : { method: "password", reason: "auth_failure" },
    });

    return result;
  };

  return { [FIELD]: wrapped };
}
