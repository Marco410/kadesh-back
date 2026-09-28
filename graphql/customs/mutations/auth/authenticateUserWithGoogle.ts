import { KeystoneContext } from "@keystone-6/core/types";
import { checkUserName } from "../../../../models/User/User.hooks";
import {
  USER_AUTH_LOG_SOURCE,
  USER_AUTH_LOG_STEP,
} from "../../../../models/User/UserAuthLog/constants";
import { writeUserAuthLog } from "../../../../utils/auth/userAuthLogWrite";
import {
  SIGNUP_ROLE_NAMES,
  findSignupRoleIds,
} from "../../../../utils/auth/signupRoles";
import { provisionSignupCompany } from "../../../../utils/access/provisionSignupCompany";
import { PRODUCT } from "../../../../utils/constants/product";

const typeDefs = `
  # isNewUser: alta nueva, no el inicio de sesión de una cuenta ya existente.
  # El front lo usa para mandar la conversión de registro solo en las altas.
  type UserAuthenticationWithGoogleSuccess {
    sessionToken: String!
    item: User!
    isNewUser: Boolean!
  }

  type UserAuthenticationWithGoogleFailure {
    message: String!
  }

  union AuthenticateUserWithGoogleResult =
    UserAuthenticationWithGoogleSuccess
    | UserAuthenticationWithGoogleFailure
`;

const definition = `
  authenticateUserWithGoogle(
    idToken: String!
    referrerCode: String
    product: String
  ): AuthenticateUserWithGoogleResult!
`;

const VALID_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

/**
 * Valida el ID token contra Google. El `aud` es lo que impide que un ID token
 * emitido para otra app sirva para entrar a Kadesh: sin esa comprobación
 * cualquiera podría autenticarse como el dueño del correo.
 */
async function verifyGoogleIdToken(idToken: string): Promise<{
  email: string;
  name?: string;
  picture?: string;
  sub: string;
} | null> {
  const expectedAudience = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!expectedAudience) {
    console.error(
      "GOOGLE_CLIENT_ID no está configurado: no se puede validar el ID token de Google.",
    );
    return null;
  }

  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error || !data.email) return null;
    // tokeninfo devuelve todo como strings.
    if (data.aud !== expectedAudience) return null;
    if (String(data.email_verified) !== "true") return null;
    if (!VALID_ISSUERS.includes(data.iss)) return null;
    return {
      email: data.email,
      name: data.name ?? undefined,
      picture: data.picture ?? undefined,
      sub: data.sub,
    };
  } catch {
    return null;
  }
}

const USER_QUERY =
  "id lastName name phone email profileImage { url } roles { name } secondLastName username verified lastLoginAt";

const resolver = {
  authenticateUserWithGoogle: async (
    _root: unknown,
    {
      idToken,
      referrerCode,
      product,
    }: {
      idToken: string;
      referrerCode?: string | null;
      product?: string | null;
    },
    context: KeystoneContext,
  ) => {
    const startedAt = Date.now();
    const isSaas = product === PRODUCT.SAAS;

    const fail = async (message: string, email: string, userId?: string) => {
      await writeUserAuthLog(context, {
        startedAt,
        source: USER_AUTH_LOG_SOURCE.GOOGLE_AUTH,
        step: USER_AUTH_LOG_STEP.GOOGLE_AUTH_FAIL,
        success: false,
        message,
        email,
        userId: userId ?? null,
        responseSnapshot: { product: isSaas ? PRODUCT.SAAS : PRODUCT.PET },
      });
      return {
        __typename: "UserAuthenticationWithGoogleFailure" as const,
        message,
      };
    };

    const payload = await verifyGoogleIdToken(idToken);
    if (!payload) {
      return fail("Token de Google inválido o expirado", "");
    }

    let user = await context.sudo().query.User.findOne({
      where: { email: payload.email },
      query: USER_QUERY,
    });

    const isNewUser = !user;

    if (!user) {
      try {
        let referredByConnect: { connect: { id: string } } | undefined;

        if (referrerCode) {
          const referrer = await context.sudo().query.User.findOne({
            where: { referralCode: referrerCode.toUpperCase() },
            query: "id",
          });

          if (referrer) {
            referredByConnect = { connect: { id: referrer.id } };
          }
        }

        const baseName = payload.name?.trim() || payload.email.split("@")[0];
        const username = await checkUserName(baseName, "", context);

        // Alta de Kadesh Negocios: mismos roles que registerUser. En Pet no se
        // mandan roles y el userRoleHook conecta "user" por defecto.
        let signupRoles: { connect: { id: string }[] } | undefined;
        if (isSaas) {
          const signupRoleIds = await findSignupRoleIds(context);
          if (signupRoleIds.length !== SIGNUP_ROLE_NAMES.length) {
            return fail(
              "No se pudieron asignar los roles de empresa. Contacta a soporte.",
              payload.email,
            );
          }
          signupRoles = { connect: signupRoleIds.map((id) => ({ id })) };
        }

        user = await context.sudo().query.User.createOne({
          data: {
            email: payload.email,
            name: baseName,
            lastName: "",
            username,
            verified: true,
            product: isSaas ? PRODUCT.SAAS : PRODUCT.PET,
            referredBy: referredByConnect,
            roles: signupRoles,
          },
          query: USER_QUERY,
        });

        // Solo Kadesh Negocios necesita empresa. provisionSignupCompany arma
        // el workspace de Ventas y liga al usuario como miembro; crear la
        // SaasCompany a mano se saltaba ese paso.
        if (isSaas) {
          await provisionSignupCompany(context, user.id, baseName);
        }
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Error al crear usuario",
          payload.email,
        );
      }
    }

    user = await context.sudo().query.User.updateOne({
      where: { id: user.id },
      data: { lastLoginAt: new Date().toISOString() },
      query: USER_QUERY,
    });

    if (!context.sessionStrategy) {
      return fail("No se pudo iniciar la sesión.", payload.email, user.id);
    }

    const sessionToken = await context.sessionStrategy.start({
      data: { listKey: "User", itemId: user.id },
      context,
    });

    // Igual que @keystone-6/auth: sin token sellado no hay sesión válida.
    if (typeof sessionToken !== "string" || sessionToken.length === 0) {
      return fail("No se pudo iniciar la sesión.", payload.email, user.id);
    }

    await writeUserAuthLog(context, {
      startedAt,
      source: USER_AUTH_LOG_SOURCE.GOOGLE_AUTH,
      step: isNewUser
        ? USER_AUTH_LOG_STEP.GOOGLE_AUTH_SIGNUP
        : USER_AUTH_LOG_STEP.GOOGLE_AUTH_LOGIN,
      success: true,
      message: isNewUser
        ? "Alta con Google correcta."
        : "Inicio de sesión con Google correcto.",
      email: payload.email,
      userId: user.id,
      responseSnapshot: {
        userId: user.id,
        isNewUser,
        product: isSaas ? PRODUCT.SAAS : PRODUCT.PET,
      },
    });

    return {
      __typename: "UserAuthenticationWithGoogleSuccess",
      sessionToken,
      item: user,
      isNewUser,
    };
  },
};

export default { typeDefs, definition, resolver };
