import { KeystoneContext } from "@keystone-6/core/types";
import { isSignedIn } from "../../../../utils/access/tenant";
import { fetchAndCacheIndicator, findCatalogIndicator } from "../../../../utils/inegi";

const typeDefs = `
  input FetchInegiIndicatorInput {
    indicatorId: String!
    geographicCode: String!
    recent: Boolean
  }

  type InegiIndicatorValue {
    cacheKey: String!
    indicatorId: String!
    indicatorName: String!
    geographicLevel: String!
    geographicCode: String!
    period: String!
    value: Float
    unit: String
  }

  type FetchInegiIndicatorResult {
    success: Boolean!
    message: String!
    created: Int!
    updated: Int!
    indicators: [InegiIndicatorValue!]!
  }

  type Mutation {
    fetchInegiIndicator(input: FetchInegiIndicatorInput!): FetchInegiIndicatorResult!
  }
`;

const definition = `
  fetchInegiIndicator(input: FetchInegiIndicatorInput!): FetchInegiIndicatorResult!
`;

const empty = {
  created: 0,
  updated: 0,
  indicators: [] as never[],
};

const resolver = {
  fetchInegiIndicator: async (
    _root: unknown,
    {
      input,
    }: {
      input: {
        indicatorId: string;
        geographicCode: string;
        recent?: boolean | null;
      };
    },
    context: KeystoneContext,
  ) => {
    if (!isSignedIn(context.session)) {
      return {
        success: false,
        message: "Debes iniciar sesión para consultar indicadores",
        ...empty,
      };
    }

    if (!process.env.INEGI_INDICADORES_TOKEN?.trim()) {
      return {
        success: false,
        message: "INEGI_INDICADORES_TOKEN no configurada",
        ...empty,
      };
    }

    const indicatorId = input.indicatorId.trim();
    const geographicCode = input.geographicCode.trim() || "00";
    const catalog = findCatalogIndicator(indicatorId);

    try {
      const { mapped, created, updated } = await fetchAndCacheIndicator(
        context,
        indicatorId,
        geographicCode,
        input.recent !== false,
      );
      return {
        success: true,
        message: catalog
          ? `${catalog.name}: ${created} nuevos, ${updated} actualizados`
          : `Indicador ${indicatorId}: ${created} nuevos, ${updated} actualizados`,
        created,
        updated,
        indicators: mapped,
      };
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error ? err.message : "Error al consultar indicadores INEGI",
        ...empty,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
