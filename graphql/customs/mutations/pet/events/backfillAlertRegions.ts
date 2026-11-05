import type { KeystoneContext } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../../../utils/access/tenant";
import { cityKey, normalizeStateCode } from "../../../../../utils/geo/mexicoStates";
import { reverseGeocode } from "../../../../../utils/pet/nominatim";
import { prismaOf } from "./shared";

/** Nominatim pide máximo una consulta por segundo. */
const NOMINATIM_GAP_MS = 1100;
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

const typeDefs = `
  type BackfillAlertRegionsResult {
    success: Boolean!
    message: String!
    processed: Int!
    updated: Int!
    remaining: Int!
  }
`;

const definition = `
  backfillAlertRegions(limit: Int): BackfillAlertRegionsResult!
`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolver = {
  /**
   * Una vez, después de desplegar los eventos: llena `alertCity` / `alertStateCode` de quienes ya
   * tenían zona de alertas (desde ahora se llenan solos al guardar la zona). Solo admins. Se corre
   * varias veces hasta que `remaining` sea 0.
   */
  backfillAlertRegions: async (_root: unknown, { limit }: { limit?: number | null }, context: KeystoneContext) => {
    const empty = { processed: 0, updated: 0, remaining: 0 };
    if (!isPlatformAdmin(context.session)) return { success: false, message: "Solo admins.", ...empty };
    try {
      const prisma = prismaOf(context);
      const take = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
      const where = { alertLat: { not: null }, alertLng: { not: null }, alertStateCode: null, anonymizedAt: null };
      const users = await prisma.user.findMany({
        where,
        select: { id: true, alertLat: true, alertLng: true },
        orderBy: { createdAt: "desc" },
        take,
      });
      if (users instanceof Error) throw users;

      let processed = 0;
      let updated = 0;
      for (const user of users as Array<{ id: string; alertLat: number; alertLng: number }>) {
        if (processed > 0) await sleep(NOMINATIM_GAP_MS);
        processed += 1;
        const place = await reverseGeocode(Number(user.alertLat), Number(user.alertLng));
        const stateCode = normalizeStateCode(place?.state);
        if (!place || !stateCode) continue;
        const saved = await prisma.user.update({
          where: { id: user.id },
          data: { alertCity: place.city || null, alertCityKey: cityKey(place.city), alertStateCode: stateCode },
        });
        if (saved instanceof Error) throw saved;
        updated += 1;
      }
      const remaining = await prisma.user.count({ where });
      return {
        success: true,
        message: `Zonas revisadas: ${processed}; con municipio y estado: ${updated}; faltan ${Number(remaining)}.`,
        processed,
        updated,
        remaining: Number(remaining),
      };
    } catch (error) {
      console.error("[backfillAlertRegions]", error);
      return { success: false, message: error instanceof Error ? error.message : "No se pudo completar.", ...empty };
    }
  },
};

export default { typeDefs, definition, resolver };
