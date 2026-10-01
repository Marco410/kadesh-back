import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId, isSignedIn } from "../../../utils/access/tenant";
import { findReportDuplicates } from "../../../utils/pet/animalReport";
import { normalizeMxPhone } from "../../../utils/pet/phone";

const typeDefs = `
  type AnimalReportDuplicate {
    id: ID!
    name: String!
    slug: String
    url: String!
  }
`;

const definition = `
  findAnimalReportDuplicates(
    phone: String
    animalTypeId: ID
    name: String
    sourceUrl: String
  ): [AnimalReportDuplicate!]!
`;

const resolver = {
  findAnimalReportDuplicates: async (
    _root: unknown,
    args: {
      phone?: string | null;
      animalTypeId?: string | null;
      name?: string | null;
      sourceUrl?: string | null;
    },
    context: KeystoneContext,
  ) => {
    if (!isSignedIn(context.session) && !getSessionUserId(context.session)) {
      throw new Error("Inicia sesión para revisar reportes parecidos.");
    }
    const rawPhone = args.phone?.trim() || "";
    const normalized = rawPhone ? normalizeMxPhone(rawPhone) : null;
    const phone = normalized?.ok ? normalized.digits : rawPhone;
    return findReportDuplicates(context, {
      phone,
      animalTypeId: args.animalTypeId,
      name: args.name,
      sourceUrl: args.sourceUrl,
    });
  },
};

const findAnimalReportDuplicates = { typeDefs, definition, resolver };
export default findAnimalReportDuplicates;
