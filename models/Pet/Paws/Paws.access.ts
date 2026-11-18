import type { ListAccessControl } from "@keystone-6/core/types";
import { nobody, ownRowWhere, signedIn } from "../../../utils/access/presets";

/**
 * Paw accounts and their ledger: a person reads only their own rows (a platform admin reads all)
 * and nobody writes through the API. Every write goes through `utils/pet/paws.ts`.
 */
export const pawReadOnlyAccess: ListAccessControl<any> = {
  operation: { query: signedIn, create: nobody, update: nobody, delete: nobody },
  filter: { query: ownRowWhere },
};
