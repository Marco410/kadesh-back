import { KeystoneContext } from "@keystone-6/core/types";
import {
  USER_AUTH_LOG_SOURCE,
  USER_AUTH_LOG_STEP,
} from "../../../../models/User/UserAuthLog/constants";
import { writeUserAuthLog } from "../../../../utils/auth/userAuthLogWrite";

const typeDefs = ``;

const definition = `
  registerUser(data: UserCreateInput!, referrerCode: String): User
`;

const resolver = {
  registerUser: async (
    _root: unknown,
    {
      data,
      referrerCode,
    }: {
      data: Record<string, unknown>;
      referrerCode?: string | null;
    },
    context: KeystoneContext
  ) => {
    const startedAt = Date.now();
    const emailStr = String(data?.email ?? "").trim();

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
        throw new Error(
          "El código de referido no pertenece a ningún usuario."
        );
      }

      referredByConnect = { connect: { id: referrer.id } };
    }

    try {
      const user = await context.sudo().query.User.createOne({
        data: {
          ...data,
          referredBy: referredByConnect,
        },
        query:
          "id name lastName secondLastName email phone username referralCode referredBy { id }",
      });

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
          referrerCode: referrerCode ? String(referrerCode).toUpperCase() : null,
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
