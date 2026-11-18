import type { KeystoneContext } from "@keystone-6/core/types";
import { pawLevelFor, type PawLevel } from "../../models/Pet/Paws/constants";
import { getPawLevels, pawsEnabled } from "./paws";

/**
 * How a person is shown publicly in Kadesh Pet (report author, ranking, public profile).
 * The name goes as first name + initial of the last name; never the account id, and contact only
 * on the public profile when the person chose to show it.
 */

/** «Marco Castañeda» or name «Marco» + lastName «Castañeda» → «Marco C.». */
export function publicDisplayName(name?: string | null, lastName?: string | null): string {
  const words = `${name ?? ""} ${lastName ?? ""}`.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Alguien de Kadesh";
  const first = words[0];
  const initial = words[1]?.charAt(0).toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}

export type PublicUserCard = {
  /** For the `/u/<username>` link. `null` when the person turned their public profile off. */
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** `null` while paws are switched off. */
  level: PawLevel | null;
};

type UserRow = {
  id: string;
  username?: string | null;
  name?: string | null;
  lastName?: string | null;
  publicProfileEnabled?: boolean | null;
  suspendedAt?: string | null;
  anonymizedAt?: string | null;
  profileImage?: { url?: string | null } | null;
};

export const PUBLIC_USER_QUERY =
  "id username name lastName publicProfileEnabled suspendedAt anonymizedAt profileImage { url }";

/** Is this person allowed to be shown at all (not suspended, not anonymized)? */
export function isPublicPerson(row: UserRow | null | undefined): row is UserRow {
  return Boolean(row && !row.suspendedAt && !row.anonymizedAt);
}

/**
 * Cards of many people in TWO queries (users with their signed photo URL + their levels), for
 * lists. People with the public profile off get no link and no photo; suspended or anonymized
 * people are left out of the map.
 */
export async function getPublicUserCards(
  context: KeystoneContext,
  userIds: Array<string | null | undefined>,
): Promise<Map<string, PublicUserCard>> {
  const cards = new Map<string, PublicUserCard>();
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return cards;

  const [rows, levels] = await Promise.all([
    context.sudo().query.User.findMany({ where: { id: { in: ids } }, query: PUBLIC_USER_QUERY }) as Promise<UserRow[]>,
    getPawLevels(context, ids),
  ]);
  const withPaws = pawsEnabled();
  for (const row of rows) {
    if (!isPublicPerson(row)) continue;
    const open = row.publicProfileEnabled !== false;
    cards.set(row.id, {
      username: open ? row.username || null : null,
      displayName: publicDisplayName(row.name, row.lastName),
      avatarUrl: open ? row.profileImage?.url ?? null : null,
      level: withPaws ? levels.get(row.id) ?? pawLevelFor(0) : null,
    });
  }
  return cards;
}
