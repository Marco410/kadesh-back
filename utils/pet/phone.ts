export type PhoneResult =
  | { ok: true; digits: string }
  | { ok: false; reason: string };

/** Teléfono mexicano de 10 dígitos. "443 521 5638" y "+52 443 521 5638" quedan "4435215638". */
export function normalizeMxPhone(raw: string): PhoneResult {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("521") && digits.length === 13) digits = digits.slice(3);
  else if (digits.startsWith("52") && digits.length === 12) digits = digits.slice(2);
  if (digits.length !== 10) {
    return { ok: false, reason: "El teléfono debe tener 10 dígitos." };
  }
  return { ok: true, digits };
}
