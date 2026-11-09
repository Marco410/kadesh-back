/**
 * Traspaso de una mascota (su cartilla completa) a otra cuenta con un código. Lo genera el dueño
 * principal, o admin/coordinación si es ficha de un espacio de rescate; quien lo recibe lo escribe
 * en su cuenta. Ver graphql/customs/mutations/pet/card/petTransfer.ts.
 */

export const PET_TRANSFER_STATUS = {
  PENDING: "pending",
  REDEEMED: "redeemed",
  CANCELLED: "cancelled",
} as const;

export const PET_TRANSFER_STATUS_OPTIONS = [
  { label: "Sin usar", value: PET_TRANSFER_STATUS.PENDING },
  { label: "Canjeado", value: PET_TRANSFER_STATUS.REDEEMED },
  { label: "Cancelado", value: PET_TRANSFER_STATUS.CANCELLED },
];

/** Días que vale un código. Después se considera vencido aunque siga `pending`. */
export const PET_TRANSFER_TTL_DAYS = 7;

/** Sin 0/O ni 1/I/L, para dictarlo por teléfono sin confusiones. */
export const PET_TRANSFER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/** Caracteres del código, sin el guion: «7KQ2-M9XA». */
export const PET_TRANSFER_CODE_LENGTH = 8;

export const PET_TRANSFER_MESSAGE_MAX = 300;
