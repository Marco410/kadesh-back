import { GraphQLError } from "graphql";
import type { KeystoneContext } from "@keystone-6/core/types";
import { PET_STATUS } from "../../../../../models/Pet/constants";
import { requirePetOwner } from "../../../../../utils/pet/petCard";

/**
 * Así se cierra hoy un reporte: el dueño agrega una bitácora "En familia" (`petLandingStats` la
 * cuenta como "en casa"). `found` no sirve aquí: en Kadesh es "encontré una mascota ajena".
 */
const BACK_HOME_STATUS = "in_family";

const typeDefs = `
  type MarkPetAsFoundResult {
    petId: ID!
    reportId: ID
  }
`;

const definition = `
  markPetAsFound(petId: ID!): MarkPetAsFoundResult!
`;

type LastLog = {
  lat?: string | null;
  lng?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  placeLabel?: string | null;
};

const resolver = {
  /** La mascota vuelve a `active` y su reporte se cierra con una bitácora "En familia". */
  markPetAsFound: async (_root: unknown, { petId }: { petId: string }, context: KeystoneContext) => {
    try {
      await requirePetOwner(context, petId);
      const sudo = context.sudo();
      const pet = (await sudo.query.Pet.findOne({
        where: { id: petId },
        query: "id status lostReport { id }",
      })) as { id: string; status: string; lostReport?: { id: string } | null } | null;
      if (!pet) throw new GraphQLError("No encontramos esta mascota en tu cartilla.");
      if (pet.status !== PET_STATUS.LOST) {
        throw new GraphQLError("Esta mascota no está reportada como perdida.");
      }

      const reportId = pet.lostReport?.id ?? null;
      if (reportId) {
        // Misma ubicación que la última bitácora, para que el pin no desaparezca del mapa.
        const [last] = (await sudo.query.AnimalLog.findMany({
          where: { animal: { id: { equals: reportId } } },
          orderBy: [{ date_status: "desc" }, { createdAt: "desc" }],
          take: 1,
          query: "lat lng address city state country neighborhood postalCode placeLabel",
        })) as LastLog[];
        await sudo.query.AnimalLog.createOne({
          data: {
            animal: { connect: { id: reportId } },
            status: BACK_HOME_STATUS,
            notes: "Regresó a casa.",
            date_status: new Date().toISOString(),
            last_seen: false,
            lat: last?.lat ?? "",
            lng: last?.lng ?? "",
            address: last?.address ?? "",
            city: last?.city ?? "",
            state: last?.state ?? "",
            country: last?.country ?? "",
            neighborhood: last?.neighborhood ?? "",
            postalCode: last?.postalCode ?? "",
            placeLabel: last?.placeLabel ?? "",
          },
          query: "id",
        });
      }

      // `Animal.pet` se queda como historial; `lostReport` solo apunta al reporte abierto.
      const prisma = (sudo as KeystoneContext & { prisma: any }).prisma;
      const updated = await prisma.pet.update({
        where: { id: petId },
        data: { status: PET_STATUS.ACTIVE, lostReportId: null },
      });
      if (updated instanceof Error) throw updated;

      return { petId, reportId };
    } catch (error) {
      console.error("[pet] markPetAsFound", error);
      if (error instanceof GraphQLError) throw error;
      const message = error instanceof Error ? error.message : "No se pudo cerrar el reporte.";
      throw new GraphQLError(message);
    }
  },
};

export default { typeDefs, definition, resolver };
