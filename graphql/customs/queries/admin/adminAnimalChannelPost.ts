import type { KeystoneContext } from "@keystone-6/core/types";
import {
  buildAnimalChannelMessage,
  FACEBOOK_POST_QUERY,
  type AnimalPostData,
} from "../../../../models/Pet/Animal/Animal.facebookPost";
import { petPublicUrl } from "../../../../utils/pet/animalReport";
import { petSiteUrl } from "../../../../utils/notifications/whatsapp";
import { assertPlatformAdmin } from "./shared";

/**
 * «Copiar para el canal» en Operaciones → Kadesh Pet → Animales. La API oficial de WhatsApp no
 * publica en Canales, así que un admin copia el texto y lo pega en el canal de Kadesh Pet con la
 * imagen de historia del cartel. Solo admin de plataforma.
 *
 * - `text`: el post (ver `buildAnimalChannelMessage`), con el enlace corto `/f/{folio}`.
 * - `storyImageUrl`: la imagen 1080 × 1920 del cartel (`/cartel/{slug}/historia` en la web).
 * - `channelUrl`: `/canal` en la web, que redirige al canal que toque.
 */
const typeDefs = `
  type AdminAnimalChannelPost {
    text: String!
    shortUrl: String!
    storyImageUrl: String
    channelUrl: String!
  }
`;

const definition = `adminAnimalChannelPost(id: ID!): AdminAnimalChannelPost`;

const resolver = {
  adminAnimalChannelPost: async (_root: unknown, { id }: { id: string }, context: KeystoneContext) => {
    assertPlatformAdmin(context);
    const animal = (await context.sudo().query.Animal.findOne({
      where: { id },
      query: FACEBOOK_POST_QUERY,
    })) as (AnimalPostData & { id: string; slug?: string | null; folio?: number | null }) | null;
    if (!animal) return null;

    const key = animal.slug || animal.id;
    const shortUrl = animal.folio ? petSiteUrl(`/f/${animal.folio}`) : petPublicUrl(key);
    return {
      text: buildAnimalChannelMessage(animal, shortUrl),
      shortUrl,
      storyImageUrl: animal.slug ? petSiteUrl(`/cartel/${animal.slug}/historia`) : null,
      channelUrl: petSiteUrl("/canal"),
    };
  },
};

export default { typeDefs, definition, resolver };
