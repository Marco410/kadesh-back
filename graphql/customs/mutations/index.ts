import customAuth from "./auth/customAuth";


const customMutation = {
  typeDefs: `
    ${customAuth.typeDefs}
  `,
  definitions: `
    ${customAuth.definition}
  `,
  resolvers: {
    ...customAuth.resolver,
  },
};

export default customMutation;
