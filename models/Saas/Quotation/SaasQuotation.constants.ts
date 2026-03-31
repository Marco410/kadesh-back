export const QUOTATION_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  EXPIRED: "expired",
} as const;

export const QUOTATION_STATUS_OPTIONS = [
  { label: "Borrador", value: QUOTATION_STATUS.DRAFT },
  { label: "Enviada", value: QUOTATION_STATUS.SENT },
  { label: "Aceptada", value: QUOTATION_STATUS.ACCEPTED },
  { label: "Rechazada", value: QUOTATION_STATUS.REJECTED },
  { label: "Expirada", value: QUOTATION_STATUS.EXPIRED },
] as const;

export const QUOTATION_DISCOUNT_TYPE = {
  NONE: "none",
  PERCENT: "percent",
  AMOUNT: "amount",
} as const;

export const QUOTATION_DISCOUNT_TYPE_OPTIONS = [
  { label: "Sin descuento", value: QUOTATION_DISCOUNT_TYPE.NONE },
  { label: "Porcentaje", value: QUOTATION_DISCOUNT_TYPE.PERCENT },
  { label: "Monto fijo", value: QUOTATION_DISCOUNT_TYPE.AMOUNT },
] as const;
