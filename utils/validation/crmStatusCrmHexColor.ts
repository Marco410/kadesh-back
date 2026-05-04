/** Color hex de 6 dígitos (#RRGGBB), mayúsculas o minúsculas. */
export const CRM_STATUS_HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function isValidCrmStatusHexColor(color: string): boolean {
  return CRM_STATUS_HEX_COLOR_REGEX.test(color.trim());
}
