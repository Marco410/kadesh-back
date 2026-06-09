import { KeystoneContext } from "@keystone-6/core/types";
import {
  getCompanyRemainingCredits,
  type RemainingCreditsBlockingReason,
  type RemainingCreditsResult as CompanyRemainingCreditsResult,
} from "../../../utils/saas/companyCredits";

export type { RemainingCreditsBlockingReason };

export type RemainingCreditsResult = CompanyRemainingCreditsResult & {
  /** @deprecated Use periodId */
  recordId: string | null;
};

export async function getRemainingCredits(
  context: KeystoneContext,
  companyId: string,
): Promise<RemainingCreditsResult> {
  const credits = await getCompanyRemainingCredits(context, companyId);
  return {
    ...credits,
    recordId: credits.periodId,
  };
}
