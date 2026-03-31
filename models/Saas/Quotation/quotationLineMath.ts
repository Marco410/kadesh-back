import { QUOTATION_DISCOUNT_TYPE } from "./SaasQuotation.constants";

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeLineAmounts(args: {
  quantity: number;
  unitPrice: number;
  discountType: string;
  discountValue: number;
  taxRate: number;
}): { lineDiscount: number; lineSubtotal: number; lineTax: number; lineTotal: number } {
  const qty = args.quantity ?? 0;
  const price = args.unitPrice ?? 0;
  const gross = qty * price;
  let discount = 0;
  if (args.discountType === QUOTATION_DISCOUNT_TYPE.PERCENT) {
    discount = gross * ((args.discountValue ?? 0) / 100);
  } else if (args.discountType === QUOTATION_DISCOUNT_TYPE.AMOUNT) {
    discount = Math.min(args.discountValue ?? 0, gross);
  }
  const lineSubtotal = roundMoney(gross - discount);
  const lineTax = roundMoney(lineSubtotal * ((args.taxRate ?? 0) / 100));
  const lineTotal = roundMoney(lineSubtotal + lineTax);
  return { lineDiscount: roundMoney(discount), lineSubtotal, lineTax, lineTotal };
}
