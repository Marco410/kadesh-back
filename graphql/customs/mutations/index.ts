import customAuth from "./auth/customAuth";
import importVeterinary from "./importVeterinary";

const customMutation = {
  typeDefs: `
    ${customAuth.typeDefs}
    ${importVeterinary.typeDefs}
  `,
  definitions: `
    ${customAuth.definition}
    ${importVeterinary.definition}
  `,
  resolvers: {
    ...customAuth.resolver,
    ...importVeterinary.resolver,
  },
};

export default customMutation;
