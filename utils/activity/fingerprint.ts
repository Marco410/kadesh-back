import { createHash } from "crypto";

/**
 * Huella de un error para agruparlo en la bandeja de Errores: mismo tipo, misma operación (o tipo
 * de caída) y mismo mensaje, sin los datos que cambian en cada vez (números, ids, correos).
 */
export function normalizeErrorMessage(message: string | null | undefined): string {
  return (message ?? "")
    .toLowerCase()
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<correo>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, "<id>")
    .replace(/\bc[a-z0-9]{20,}\b/g, "<id>")
    .replace(/\b[0-9a-f]{24,}\b/g, "<id>")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export function errorFingerprint(parts: {
  type: string;
  /** Solo para errores del navegador: el mismo fallo en dos apps es un bug distinto. */
  app?: string | null;
  operation?: string | null;
  kind?: string | null;
  message?: string | null;
}): string {
  const raw = [
    parts.type,
    parts.app ?? "",
    parts.operation ?? parts.kind ?? "",
    normalizeErrorMessage(parts.message),
  ].join("|");
  return createHash("sha1").update(raw).digest("hex").slice(0, 20);
}
