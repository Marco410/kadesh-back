import { KeystoneContext } from "@keystone-6/core/types";
import { QUOTATION_STATUS } from "./SaasQuotation.constants";

async function nextQuotationNumber(
  context: KeystoneContext,
  companyId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;
  const rows = await context.sudo().query.SaasQuotation.findMany({
    where: { company: { id: { equals: companyId } } },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    query: "quotationNumber",
  });
  let max = 0;
  for (const r of rows as { quotationNumber: string }[]) {
    const qn = r.quotationNumber;
    if (qn?.startsWith(prefix)) {
      const part = qn.slice(prefix.length);
      const n = parseInt(part, 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export const quotationHooks = {
  resolveInput: async ({
    operation,
    resolvedData,
    context,
  }: {
    operation: string;
    resolvedData: Record<string, unknown>;
    context: KeystoneContext;
  }) => {
    if (operation !== "create") return resolvedData;

    const connect = resolvedData.company as { connect?: { id: string } } | undefined;
    const companyId = connect?.connect?.id;
    if (!companyId) return resolvedData;

    if (!resolvedData.quotationNumber || String(resolvedData.quotationNumber).trim() === "") {
      resolvedData.quotationNumber = await nextQuotationNumber(context, companyId);
    }

    const session = context.session as { data?: { id: string } } | undefined;
    const userId = session?.data?.id;
    if (userId && !resolvedData.createdBy) {
      resolvedData.createdBy = { connect: { id: userId } };
    }

    if (!resolvedData.status) {
      resolvedData.status = QUOTATION_STATUS.DRAFT;
    }

    return resolvedData;
  },
};
