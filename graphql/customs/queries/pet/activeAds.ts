import type { KeystoneContext } from "@keystone-6/core/types";
import { getActiveAds } from "../../../../utils/pet/ads";

/**
 * Every ad live right now, for Kadesh Pet (web and app). Public. Comes from memory (5 min, cleared
 * when an ad is saved); the client picks per screen by placement and zone. See models/Pet/Ad/README.md.
 */
const typeDefs = `
  type PublicAd {
    id: ID!
    "house | store_product | pet_place | animal | brand"
    kind: String!
    title: String!
    body: String!
    brandLabel: String!
    ctaLabel: String!
    "orange | green | sky | violet | neutral"
    tone: String!
    imageUrl: String
    "A path of Kadesh Pet (/animales/…, /tienda/…, /veterinarias/…) or an outside https link."
    href: String!
    "animal_detail | vet_detail | blog | store"
    placements: [String!]!
    "1 to 10: share of the rotation."
    weight: Int!
    "The animal, product or clinic it promotes: its own page does not show it."
    targetId: ID
    "national | radius. With radius, show it only within radiusKm of the screen's reference point."
    geoScope: String!
    lat: Float
    lng: Float
    radiusKm: Int
  }
`;

const definition = `activeAds: [PublicAd!]!`;

const resolver = {
  activeAds: async (_root: unknown, _args: unknown, context: KeystoneContext) => {
    try {
      return await getActiveAds(context);
    } catch (error) {
      // An ad never breaks a page: without the list, the slot shows nothing.
      console.error("[activeAds]", error);
      return [];
    }
  },
};

export default { typeDefs, definition, resolver };
