/**
 * Public switch of the Kadesh Pet store. Off (the default), the public catalog answers empty and
 * the shopper mutations refuse; platform admins still see and edit everything, so the catalog can
 * be loaded before launch.
 */
export function storeEnabled(): boolean {
  const value = (process.env.STORE_ENABLED ?? "").trim().toLowerCase();
  return value === "true" || value === "on" || value === "1";
}

/**
 * Bumped on every catalog write (product, variant, category, brand). In-memory caches of catalog
 * data compare it to know they are stale, so an admin edit shows up without waiting for the cache.
 */
let catalogVersion = 0;

export function storeCatalogVersion(): number {
  return catalogVersion;
}

export function bumpStoreCatalogVersion(): void {
  catalogVersion += 1;
}
