import { KeystoneContext } from "@keystone-6/core/types";
import { QUOTATION_DISCOUNT_TYPE } from "../SaasQuotation.constants";
import { computeLineAmounts, roundMoney } from "../quotationLineMath";

const pendingRecalcKey = "__saasQuotationRecalcAfterDelete";
const previousQuoteRecalcKey = "__saasQuotationRecalcPreviousQuoteId";

function resolvedDataUpdatesQuote(resolvedData?: Record<string, unknown>): boolean {
  return !!resolvedData && Object.prototype.hasOwnProperty.call(resolvedData, "quotation");
}

function getQuoteIdFromResolved(
  resolvedData: Record<string, unknown>,
  item: { quoteId?: string | null } | null,
): string | null {
  const fromConnect = (resolvedData.quotation as { connect?: { id: string } } | undefined)
    ?.connect?.id;
  if (fromConnect) return fromConnect;
  if (item?.quoteId) return String(item.quoteId);
  return null;
}

async function recalculateQuotationTotals(
  context: KeystoneContext,
  quotationId: string,
): Promise<void> {
  const lines = await context.sudo().query.SaasQuotationProduct.findMany({
    where: { quotation: { id: { equals: quotationId } } },
    query: "quantity unitPrice discountType discountValue taxRate",
  });

  let discountTotal = 0;
  let subtotal = 0;
  let total = 0;

  for (const line of lines as {
    quantity: number | null;
    unitPrice: number | null;
    discountType: string | null;
    discountValue: number | null;
    taxRate: number | null;
  }[]) {
    const amounts = computeLineAmounts({
      quantity: line.quantity ?? 0,
      unitPrice: line.unitPrice ?? 0,
      discountType: line.discountType ?? QUOTATION_DISCOUNT_TYPE.NONE,
      discountValue: line.discountValue ?? 0,
      taxRate: line.taxRate ?? 0,
    });
    discountTotal += amounts.lineDiscount;
    subtotal += amounts.lineSubtotal;
    total += amounts.lineTotal;
  }

  discountTotal = roundMoney(discountTotal);
  subtotal = roundMoney(subtotal);
  const taxTotal = roundMoney(total - subtotal);
  total = roundMoney(total);

  await context.sudo().query.SaasQuotation.updateOne({
    where: { id: quotationId },
    data: {
      subtotal,
      discountTotal,
      taxTotal,
      total,
    },
  });
}

export const quotationProductHooks = {
  beforeOperation: async ({
    operation,
    item,
    context,
    resolvedData,
  }: {
    operation: string;
    item?: { id?: string };
    context: KeystoneContext;
    resolvedData?: Record<string, unknown>;
  }) => {
    const ctx = context as unknown as Record<string, string>;

    if (operation === "update" && item?.id && resolvedDataUpdatesQuote(resolvedData)) {
      const row = await context.sudo().query.SaasQuotationProduct.findOne({
        where: { id: item.id },
        query: "quotation { id }",
      });
      const prev = (row as { quotation?: { id: string } | null } | null)?.quotation?.id;
      if (prev) ctx[previousQuoteRecalcKey] = prev;
    }

    if (operation !== "delete" || !item?.id) return;

    const rowDel = await context.sudo().query.SaasQuotationProduct.findOne({
      where: { id: item.id },
      query: "quotation { id }",
    });
    const qid = (rowDel as { quotation?: { id: string } | null } | null)?.quotation?.id;
    if (qid) {
      ctx[pendingRecalcKey] = qid;
    }
  },

  resolveInput: async ({
    operation,
    resolvedData,
    item,
  }: {
    operation: string;
    resolvedData: Record<string, unknown>;
    item?: {
      quantity?: number | null;
      unitPrice?: number | null;
      discountType?: string | null;
      discountValue?: number | null;
      taxRate?: number | null;
    } | null;
  }) => {
    if (operation === "delete") return resolvedData;

    const quantity =
      resolvedData.quantity !== undefined
        ? Number(resolvedData.quantity)
        : (item?.quantity ?? 0);
    const unitPrice =
      resolvedData.unitPrice !== undefined
        ? Number(resolvedData.unitPrice)
        : (item?.unitPrice ?? 0);
    const discountType = String(
      resolvedData.discountType ?? item?.discountType ?? QUOTATION_DISCOUNT_TYPE.NONE,
    );
    const discountValue =
      resolvedData.discountValue !== undefined
        ? Number(resolvedData.discountValue)
        : (item?.discountValue ?? 0);
    const taxRate =
      resolvedData.taxRate !== undefined
        ? Number(resolvedData.taxRate)
        : (item?.taxRate ?? 0);

    const { lineSubtotal, lineTotal } = computeLineAmounts({
      quantity,
      unitPrice,
      discountType,
      discountValue,
      taxRate,
    });

    resolvedData.lineSubtotal = lineSubtotal;
    resolvedData.lineTotal = lineTotal;

    return resolvedData;
  },

  afterOperation: async ({
    listKey,
    operation,
    item,
    context,
    resolvedData,
  }: {
    listKey: string;
    operation: string;
    item?: { quoteId?: string | null; id?: string };
    context: KeystoneContext;
    resolvedData?: Record<string, unknown>;
  }) => {
    if (listKey !== "SaasQuotationProduct") return;
    if (operation !== "create" && operation !== "update" && operation !== "delete") {
      return;
    }

    let quoteId: string | null = null;

    if (operation === "delete") {
      const ctx = context as unknown as Record<string, string>;
      quoteId = ctx[pendingRecalcKey] ?? null;
      delete ctx[pendingRecalcKey];
    } else {
      quoteId = item?.quoteId ? String(item.quoteId) : null;
      if (!quoteId && resolvedData) {
        quoteId = getQuoteIdFromResolved(resolvedData, item ?? null);
      }
    }

    const ctx = context as unknown as Record<string, string>;
    const previousQuoteId = ctx[previousQuoteRecalcKey];
    delete ctx[previousQuoteRecalcKey];

    const quoteIds = new Set<string>();
    if (quoteId) quoteIds.add(quoteId);
    if (previousQuoteId && previousQuoteId !== quoteId) {
      quoteIds.add(previousQuoteId);
    }
    if (quoteIds.size === 0) return;

    try {
      for (const id of quoteIds) {
        await recalculateQuotationTotals(context, id);
      }
    } catch (e) {
      console.error("Error recalculating quotation totals:", e);
    }
  },
};
