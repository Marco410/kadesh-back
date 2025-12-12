import type { GraphQLSchema } from "graphql";
import { mergeSchemas } from "@graphql-tools/schema";
import customMutation from "./customs/mutations";
import customQuery from "./customs/queries";

export default function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: `
      ${customMutation.typeDefs}
      ${customQuery.typeDefs}
      type Mutation {
        ${customMutation.definitions}
      }
      type Query {
        ${customQuery.definitions}
      }
    `,
    resolvers: {
      Mutation: {
        ...customMutation.resolvers,
      },
      Query: {
        ...customQuery.resolvers,
      },
    },
  });
}
