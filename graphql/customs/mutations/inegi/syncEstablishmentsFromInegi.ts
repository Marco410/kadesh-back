import { KeystoneContext } from "@keystone-6/core/types";
import { INEGI_LIVE_SYNC_CAP, INEGI_SYNC_SOURCE } from "../../../../models/Tech/Inegi/constants";
import {
  getSessionUserId,
  isSignedIn,
} from "../../../../utils/access/tenant";
import {
  DENUE_MAX_RADIUS_METERS,
  DENUE_PAGE_SIZE_CAP,
  mapDenueApiRow,
  searchByAreaActivity,
  searchByLocation,
  upsertEstablishment,
} from "../../../../utils/inegi";
import type { DenueEstablishment } from "../../../../utils/inegi/types";

const typeDefs = `
  input SyncEstablishmentsFromInegiInput {
    lat: Float
    lng: Float
    radiusMeters: Int
    keyword: String
    stateCode: String
    municipalityCode: String
    localityCode: String
    scianCode: String
    maxResults: Int
  }

  type SyncEstablishmentsFromInegiResult {
    success: Boolean!
    message: String!
    created: Int!
    updated: Int!
    alreadyInDb: Int!
    totalFetched: Int!
  }

  type Mutation {
    syncEstablishmentsFromInegi(input: SyncEstablishmentsFromInegiInput!): SyncEstablishmentsFromInegiResult!
  }
`;

const definition = `
  syncEstablishmentsFromInegi(input: SyncEstablishmentsFromInegiInput!): SyncEstablishmentsFromInegiResult!
`;

type SyncInput = {
  lat?: number | null;
  lng?: number | null;
  radiusMeters?: number | null;
  keyword?: string | null;
  stateCode?: string | null;
  municipalityCode?: string | null;
  localityCode?: string | null;
  scianCode?: string | null;
  maxResults?: number | null;
};

type SyncResult = {
  success: boolean;
  message: string;
  created: number;
  updated: number;
  alreadyInDb: number;
  totalFetched: number;
};

function emptyResult(message: string, extras?: Partial<SyncResult>): SyncResult {
  return {
    success: false,
    message,
    created: 0,
    updated: 0,
    alreadyInDb: 0,
    totalFetched: 0,
    ...extras,
  };
}

async function logSync(
  context: KeystoneContext,
  userId: string | null,
  input: SyncInput,
  result: SyncResult,
) {
  try {
    await context.sudo().query.TechInegiSyncLog.createOne({
      data: {
        ...(userId ? { user: { connect: { id: userId } } } : {}),
        success: result.success,
        message: result.message,
        created: result.created,
        updated: result.updated,
        alreadyInDb: result.alreadyInDb,
        totalFetched: result.totalFetched,
        sourceMethod: INEGI_SYNC_SOURCE.API,
        searchParams: input,
      },
    });
  } catch (err) {
    console.error("TechInegiSyncLog create failed", err);
  }
}

async function fetchRows(input: SyncInput, cap: number): Promise<DenueEstablishment[]> {
  const hasPoint =
    typeof input.lat === "number" && typeof input.lng === "number";
  const stateCode = input.stateCode?.trim();

  if (hasPoint) {
    return searchByLocation({
      lat: input.lat as number,
      lng: input.lng as number,
      radiusMeters: input.radiusMeters ?? 1000,
      keyword: input.keyword ?? undefined,
    });
  }

  if (stateCode) {
    return searchByAreaActivity({
      stateCode,
      municipalityCode: input.municipalityCode ?? undefined,
      localityCode: input.localityCode ?? undefined,
      scianCode: input.scianCode ?? undefined,
      keyword: input.keyword ?? undefined,
      start: 1,
      end: Math.min(cap, DENUE_PAGE_SIZE_CAP),
    });
  }

  throw new Error(
    "Indica lat/lng (búsqueda por radio) o stateCode (búsqueda por área)",
  );
}

const resolver = {
  syncEstablishmentsFromInegi: async (
    _root: unknown,
    { input }: { input: SyncInput },
    context: KeystoneContext,
  ): Promise<SyncResult> => {
    if (!isSignedIn(context.session)) {
      return emptyResult("Debes iniciar sesión para sincronizar DENUE");
    }

    if (!process.env.INEGI_DENUE_TOKEN?.trim()) {
      return emptyResult("INEGI_DENUE_TOKEN no configurada");
    }

    const userId = getSessionUserId(context.session);
    const cap = Math.min(
      Math.max(1, input.maxResults ?? INEGI_LIVE_SYNC_CAP),
      INEGI_LIVE_SYNC_CAP,
    );

    if (
      typeof input.radiusMeters === "number" &&
      input.radiusMeters > DENUE_MAX_RADIUS_METERS
    ) {
      const result = emptyResult(
        `El radio máximo de DENUE es ${DENUE_MAX_RADIUS_METERS} metros`,
      );
      await logSync(context, userId, input, result);
      return result;
    }

    try {
      const rows = (await fetchRows(input, cap)).slice(0, cap);
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of rows) {
        const mapped = mapDenueApiRow(row);
        if (!mapped) {
          skipped += 1;
          continue;
        }
        const status = await upsertEstablishment(context, mapped);
        if (status === "created") created += 1;
        else updated += 1;
      }

      const result: SyncResult = {
        success: true,
        message: `DENUE: ${created} nuevos, ${updated} actualizados, ${skipped} omitidos`,
        created,
        updated,
        alreadyInDb: updated,
        totalFetched: rows.length,
      };
      await logSync(context, userId, input, result);
      return result;
    } catch (err) {
      const result = emptyResult(
        err instanceof Error ? err.message : "Error al consultar DENUE",
      );
      await logSync(context, userId, input, result);
      return result;
    }
  },
};

export default { typeDefs, definition, resolver };
