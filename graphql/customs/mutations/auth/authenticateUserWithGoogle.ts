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
  authenticateUserWithGoogle(idToken: String!): AuthenticateUserWithGoogleResult!
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
  "id lastName name phone email profileImage { url } roles { name } secondLastName username verified";

const resolver = {
  authenticateUserWithGoogle: async (
    _root: unknown,
    { idToken }: { idToken: string },
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

    console.log("user");
    console.log(user);

    if (!user) {
      try {
        const [userRole] = await context.sudo().query.Role.findMany({
          where: { name: { equals: Role.USER } },
          take: 1,
          query: "id",
        });
        console.log("userRole");
        console.log(userRole);
        const username = await checkUserName(
          payload.name?.trim() || payload.email.split("@")[0],
          "",
          context,
        );
        user = await context.sudo().query.User.createOne({
          data: {
            email: payload.email,
            name: payload.name?.trim() || payload.email.split("@")[0],
            lastName: "",
            username,
            verified: true,
            roles: userRole ? { connect: [{ id: userRole.id }] } : undefined,
          },
          query: USER_QUERY,
        });

        console.log("user created");
        console.log(user);
      } catch (err) {
        console.log("error creating user");
        console.log(err);
        return {
          __typename: "UserAuthenticationWithGoogleFailure",
          message:
            err instanceof Error ? err.message : "Error al crear usuario",
        };
      }
    }

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
