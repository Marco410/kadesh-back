import type { GraphQLSchema } from "graphql";
import { mergeSchemas } from "@graphql-tools/schema";
import type { KeystoneContext } from "@keystone-6/core/types";
import customMutation from "./customs/mutations";
import customQuery from "./customs/queries";
import { persistPetPlaceSlugIfMissing } from "../models/Pet/PetPlace/PetPlace.hooks";
import { getSignedStorageUrl } from "../utils/intregrations/s3Storage";

type PetPlaceSlugParent = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  municipality?: string | null;
  state?: string | null;
};

type WhatsAppMessageMediaParent = {
  mediaKey?: string | null;
};

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
      extend type TechWhatsAppMessage {
        "URL firmada (1h) del archivo en R2, calculada al vuelo a partir de mediaKey."
        mediaUrl: String
      }
    `,
    resolvers: {
      Mutation: {
        ...customMutation.resolvers,
      },
      Query: {
        ...customQuery.resolvers,
      },
      PetPlace: {
        slug: async (
          item: PetPlaceSlugParent,
          _args: unknown,
          context: KeystoneContext,
        ) => {
          if (item?.slug) return item.slug;
          if (!item?.id) return null;
          return persistPetPlaceSlugIfMissing(
            {
              id: item.id,
              name: item.name,
              slug: item.slug,
              municipality: item.municipality,
              state: item.state,
            },
            context,
          );
        },
      },
      TechWhatsAppMessage: {
        mediaUrl: async (item: WhatsAppMessageMediaParent) => {
          if (!item?.mediaKey) return null;
          return getSignedStorageUrl({ key: item.mediaKey });
        },
      },
      ...(customMutation.extraResolvers ?? {}),
    },
  });
}
