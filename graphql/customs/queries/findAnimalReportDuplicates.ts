import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId, isSignedIn } from "../../../utils/access/tenant";
import { findSimilarReports } from "../../../utils/pet/animalReport";
import { normalizeMxPhone } from "../../../utils/pet/phone";

/**
 * Reportes parecidos al que alguien está llenando. Los argumentos nuevos (ubicación, estatus,
 * señas) son opcionales: un cliente que solo manda teléfono, tipo, nombre y enlace sigue
 * recibiendo lo de antes. `kind` dice si es el mismo reporte otra vez (`duplicate`) o el otro
 * lado de la historia (`match`: perdido con encontrado). Nunca regresa teléfonos ni nombres de
 * quien reportó (la ficha tampoco los muestra a otras personas).
 */
const typeDefs = `
  type AnimalReportDuplicate {
    id: ID!
    name: String!
    slug: String
    url: String!
    score: Int!
    level: String!
    kind: String!
    reasons: [String!]!
    distanceKm: Float
    status: String
    placeLabel: String
    city: String
    reportedAt: DateTime
    coverUrl: String
    reportedBy: String
    """El reporte parecido es de quien pregunta."""
    isMine: Boolean!
  }
`;

const definition = `
  findAnimalReportDuplicates(
    phone: String
    phone2: String
    animalTypeId: ID
    name: String
    sourceUrl: String
    lat: Float
    lng: Float
    status: String
    sex: String
    color: String
    breedId: ID
    description: String
    lostDate: DateTime
    excludeAnimalId: ID
  ): [AnimalReportDuplicate!]!
`;

type Args = {
  phone?: string | null;
  phone2?: string | null;
  animalTypeId?: string | null;
  name?: string | null;
  sourceUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  status?: string | null;
  sex?: string | null;
  color?: string | null;
  breedId?: string | null;
  description?: string | null;
  lostDate?: Date | string | null;
  excludeAnimalId?: string | null;
};

function cleanPhone(raw?: string | null) {
  const value = raw?.trim() || "";
  if (!value) return "";
  const normalized = normalizeMxPhone(value);
  return normalized.ok ? normalized.digits : value;
}

const resolver = {
  findAnimalReportDuplicates: async (_root: unknown, args: Args, context: KeystoneContext) => {
    const sessionUserId = getSessionUserId(context.session);
    if (!isSignedIn(context.session) && !sessionUserId) {
      throw new Error("Inicia sesión para revisar reportes parecidos.");
    }
    const reports = await findSimilarReports(context, {
      phone: cleanPhone(args.phone),
      phone2: cleanPhone(args.phone2),
      animalTypeId: args.animalTypeId,
      name: args.name,
      sourceUrl: args.sourceUrl,
      lat: args.lat,
      lng: args.lng,
      status: args.status,
      sex: args.sex,
      color: args.color,
      breedId: args.breedId,
      description: args.description,
      lostDate: args.lostDate,
      excludeAnimalId: args.excludeAnimalId,
    });
    return reports.map(({ userId, ...report }) => ({
      ...report,
      isMine: Boolean(sessionUserId && userId === sessionUserId),
    }));
  },
};

const findAnimalReportDuplicates = { typeDefs, definition, resolver };
export default findAnimalReportDuplicates;
