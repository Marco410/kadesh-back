import { KeystoneContext } from "@keystone-6/core/types";

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
    let referredByConnect: { connect: { id: string } } | undefined;

    if (referrerCode) {
      const referrer = await context.sudo().query.User.findOne({
        where: { referralCode: referrerCode.toUpperCase() },
        query: "id",
      });

      if (!referrer) {
        throw new Error(
          "El código de referido no pertenece a ningún usuario."
        );
      }

      referredByConnect = { connect: { id: referrer.id } };
    }

    const user = await context.sudo().query.User.createOne({
      data: {
        ...data,
        referredBy: referredByConnect,
      },
      query:
        "id name lastName secondLastName email phone username referralCode referredBy { id }",
    });

    return user;
  },
};

export default { typeDefs, definition, resolver };

