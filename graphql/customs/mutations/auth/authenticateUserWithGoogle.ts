import { KeystoneContext } from "@keystone-6/core/types";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { checkUserName } from "../../../../models/User/User.hooks";
import { Role } from "../../../../models/Role/constants";

const typeDefs = `
  type UserAuthenticationWithGoogleSuccess {
    sessionToken: String!
    item: User!
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
  ): AuthenticateUserWithGoogleResult!
`;

async function verifyGoogleIdToken(idToken: string): Promise<{
  email: string;
  name?: string;
  picture?: string;
  sub: string;
} | null> {
  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error || !data.email) return null;
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
    }: {
      idToken: string;
      referrerCode?: string | null;
    },
    context: KeystoneContext,
  ) => {
    const payload = await verifyGoogleIdToken(idToken);
    if (!payload) {
      return {
        __typename: "UserAuthenticationWithGoogleFailure",
        message: "Token de Google inválido o expirado",
      };
    }

    let user = await context.sudo().query.User.findOne({
      where: { email: payload.email },
      query: USER_QUERY,
    });


    if (!user) {
      try {
        const [userRole] = await context.sudo().query.Role.findMany({
          where: { name: { equals: Role.USER } },
          take: 1,
          query: "id",
        });

        let referredByConnect:
          | {
              connect: { id: string };
            }
          | undefined;

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

        user = await context.sudo().query.User.createOne({
          data: {
            email: payload.email,
            name: baseName,
            lastName: "",
            username,
            verified: true,
            referredBy: referredByConnect,
            roles: userRole ? { connect: [{ id: userRole.id }] } : undefined,
          },
          query: USER_QUERY,
        });

        // Crear automáticamente una SaasCompany básica usando el nombre del usuario
        const company = await context.sudo().query.SaasCompany.createOne({
          data: {
            name: baseName,
          },
          query: "id",
        });

        try {
          const [adminCompanyRole] = await context.sudo().query.Role.findMany({
            where: { name: { equals: Role.ADMIN_COMPANY } },
            take: 1,
            query: "id",
          });

          await context.sudo().query.User.updateOne({
            where: { id: user.id },
            data: {
              company: { connect: { id: company.id } },
              ...(adminCompanyRole && {
                roles: {
                  connect: [{ id: adminCompanyRole.id }],
                },
              }),
            },
          });
        } catch (error) {
          console.error(
            "Error al asignar compañía y rol ADMIN_COMPANY al usuario de Google:",
            error,
          );
        }

      } catch (err) {
        return {
          __typename: "UserAuthenticationWithGoogleFailure",
          message:
            err instanceof Error ? err.message : "Error al crear usuario",
        };
      }
    }

    user = await context.sudo().query.User.updateOne({
      where: { id: user.id },
      data: { lastLoginAt: new Date().toISOString() },
      query: USER_QUERY,
    });

    let sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret && process.env.NODE_ENV !== "production") {
      sessionSecret = randomBytes(32).toString("hex");
    }

    const sessionToken = jwt.sign(
      {
        data: {
          id: user.id,
          email: user.email,
        },
      },
      sessionSecret!,
    );

    // Iniciar sesión de Keystone (cookie) para que authenticatedItem funcione
    const sessionStrategy = (context as any).sessionStrategy;
    if (sessionStrategy?.start && (context as any).res) {
      try {
        await sessionStrategy.start({
          context,
          data: { listKey: "User", itemId: user.id },
        });
      } catch (_) {
        // Si falla (ej. contexto sin res), el cliente puede usar sessionToken
      }
    }

    return {
      __typename: "UserAuthenticationWithGoogleSuccess",
      sessionToken,
      item: user,
    };
  },
};

export default { typeDefs, definition, resolver };
