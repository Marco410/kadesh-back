import type { GraphQLSchema } from "graphql";
import { mergeSchemas } from "@graphql-tools/schema";
import customMutation from "./customs/mutations";

export default function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: `
      ${customMutation.typeDefs}
      type Mutation {
        ${customMutation.definitions}
      }
    `,
    resolvers: {
      Mutation: {
        ...customMutation.resolvers,
      },
    },
  });
}
