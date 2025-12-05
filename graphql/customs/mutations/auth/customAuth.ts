import { KeystoneContext } from "@keystone-6/core/types";
import jwt from 'jsonwebtoken';
import { randomBytes } from "crypto";
import { checkUserName } from "../../../../models/User/User.hooks";

const typeDefs = `
  type customAuthType {
    message: String,
    success: Boolean,
    data: JSON
  }
`;

const definition =
  "customAuth(email: String!, name: String, lastName: String): customAuthType";

const resolver = {
  customAuth: async (
    root: any,
    {
      email,
      name,
      lastName,
    }: {
      email: string;
      name: string;
      lastName: string;
    },
    context: KeystoneContext,
  ) => {

    let userFound = await context.sudo().query.User.findOne({
      query: "id name lastName secondLastName username email phone role birthday age verified createdAt profileImage { url } ",
      where: {
        email,
      },
    });

    if (!userFound) {
      userFound = await context.db.User.createOne({
        data: {
          email,
          name,
          lastName,
          username: await checkUserName(name, lastName, context),
          role: "user"
        }
      });
    }

    let sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
      sessionSecret = randomBytes(32).toString("hex");
    }

    const sessionToken = jwt.sign(
      {
        data: {
          id: userFound.id,
          email: userFound.email,
        },
      },
      sessionSecret
    );

    console.log("userFound");
    console.log(userFound);

    return {
      success: true,
      message: "Success",
      data: {
        ...userFound,
        sessionToken
      },
    };
  },
};

export default { typeDefs, definition, resolver };

