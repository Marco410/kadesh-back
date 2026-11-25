import type { KeystoneContext } from "@keystone-6/core/types";

/**
 * Public switch of «Dame una patita». Off (the default), `createDonation` refuses (platform admins
 * may still test it) and the landing keeps its old payment link.
 */
export function donationsEnabled(): boolean {
  const value = (process.env.DONATIONS_ENABLED ?? "").trim().toLowerCase();
  return value === "true" || value === "on" || value === "1";
}

/**
 * Bumped when a donation is paid, refunded or edited by an admin. The in-memory caches of the
 * wall, ranking and summary compare it to know they are stale.
 */
let donationsVersion = 0;

export function donationsDataVersion(): number {
  return donationsVersion;
}

export function bumpDonationsDataVersion(): void {
  donationsVersion += 1;
}

export function donationPrisma(context: KeystoneContext): any {
  return (context.sudo() as KeystoneContext & { prisma: any }).prisma;
}
