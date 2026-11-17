import { graphql } from "@keystone-6/core";
import { virtual } from "@keystone-6/core/fields";
import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId, isPlatformAdmin } from "../../../../utils/access/tenant";
import { canEditAnimalAs } from "../Animal.access";
import { SIGHTINGS_DEFAULT_TAKE, SIGHTINGS_MAX_TAKE } from "./constants";

/**
 * `Animal.sightings`: los «Lo vi» del reporte, para la ficha. Va en la misma consulta que la ficha
 * (no es otra petición) y es una sola consulta por animal; no lo pidas en listas.
 *
 * Al público le llegan lugar, hora y nota de los visibles. Quien atiende el reporte (o un admin)
 * ve también los ocultos y el contacto que dejaron.
 */
type SightingRow = {
  id: string;
  seenAt: Date | null;
  lat: string;
  lng: string;
  placeLabel: string;
  city: string;
  state: string;
  notes: string;
  contactName: string;
  contactPhone: string;
  hidden: boolean;
  createdAt: Date | null;
};

type SightingSource = {
  id: string;
  seenAt: string | null;
  lat: string;
  lng: string;
  placeLabel: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  createdAt: string | null;
  hidden: boolean;
  contactName: string | null;
  contactPhone: string | null;
};

const AnimalSightingPublic = graphql.object<SightingSource>()({
  name: "AnimalSightingPublic",
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    seenAt: graphql.field({ type: graphql.String }),
    lat: graphql.field({ type: graphql.nonNull(graphql.String) }),
    lng: graphql.field({ type: graphql.nonNull(graphql.String) }),
    placeLabel: graphql.field({ type: graphql.String }),
    city: graphql.field({ type: graphql.String }),
    state: graphql.field({ type: graphql.String }),
    notes: graphql.field({ type: graphql.String }),
    createdAt: graphql.field({ type: graphql.String }),
    /** Solo `true` para quien atiende el reporte (al público no le llegan los ocultos). */
    hidden: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    /** Solo para quien atiende el reporte; al público le llega null. */
    contactName: graphql.field({ type: graphql.String }),
    contactPhone: graphql.field({ type: graphql.String }),
  },
});

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export const animalSightingsField = virtual({
  field: graphql.field({
    type: graphql.nonNull(graphql.list(graphql.nonNull(AnimalSightingPublic))),
    args: { take: graphql.arg({ type: graphql.Int }) },
    async resolve(item: any, args: { take?: number | null }, context: KeystoneContext) {
      const take = Math.min(Math.max(1, args.take ?? SIGHTINGS_DEFAULT_TAKE), SIGHTINGS_MAX_TAKE);
      const canSeePrivate =
        isPlatformAdmin(context.session) ||
        (await canEditAnimalAs(context, item, getSessionUserId(context.session)));
      const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
      const rows = (await prisma.animalSighting.findMany({
        where: { animalId: item.id, ...(canSeePrivate ? {} : { hidden: false }) },
        orderBy: [{ seenAt: "desc" }],
        take,
        select: {
          id: true,
          seenAt: true,
          lat: true,
          lng: true,
          placeLabel: true,
          city: true,
          state: true,
          notes: true,
          contactName: true,
          contactPhone: true,
          hidden: true,
          createdAt: true,
        },
      })) as SightingRow[] | Error;
      // Prisma de Keystone devuelve el error en vez de lanzarlo.
      if (rows instanceof Error) throw rows;
      return rows.map((row) => ({
        id: row.id,
        seenAt: iso(row.seenAt),
        lat: row.lat,
        lng: row.lng,
        placeLabel: row.placeLabel || null,
        city: row.city || null,
        state: row.state || null,
        notes: row.notes || null,
        createdAt: iso(row.createdAt),
        hidden: canSeePrivate ? row.hidden : false,
        contactName: canSeePrivate ? row.contactName || null : null,
        contactPhone: canSeePrivate ? row.contactPhone || null : null,
      }));
    },
  }),
  ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
});
