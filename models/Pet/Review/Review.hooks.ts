import type { KeystoneContext } from "@keystone-6/core/types";
import { forceSessionUser, isClientNonAdmin } from "../../../utils/access/presets";

/**
 * Reseñas de veterinarias. Las que escribe una persona quedan a su nombre; los campos de Google
 * (`google_user*`) y `product` solo los llena la importación del servidor (sudo) o un admin.
 */

const CLIENT_BLOCKED_FIELDS = ["google_user", "google_user_photo", "product"] as const;

export function reviewResolveInput({
  resolvedData,
  operation,
  context,
}: {
  resolvedData: Record<string, any>;
  operation: string;
  context: KeystoneContext;
}): Record<string, any> {
  const next = forceSessionUser(resolvedData, operation, context);
  if (operation !== "create" || !isClientNonAdmin(context)) return next;
  const clean = { ...next };
  for (const field of CLIENT_BLOCKED_FIELDS) delete clean[field];
  return clean;
}

export function reviewValidateInput({
  operation,
  resolvedData,
  context,
  addValidationError,
}: {
  operation: string;
  resolvedData: Record<string, any>;
  context: KeystoneContext;
  addValidationError: (message: string) => void;
}): void {
  if (operation !== "create" || !isClientNonAdmin(context)) return;
  if (!resolvedData?.pet_place?.connect?.id) {
    addValidationError("La reseña debe ser de una veterinaria.");
  }
  const rating = resolvedData?.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    addValidationError("La calificación debe ser de 1 a 5 estrellas.");
  }
}
