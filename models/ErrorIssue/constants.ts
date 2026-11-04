/** Estado de un error agrupado en la bandeja de Errores de Operaciones. */
export const ERROR_ISSUE_STATUS = {
  OPEN: "open",
  RESOLVED: "resolved",
  IGNORED: "ignored",
} as const;

export type ErrorIssueStatus = (typeof ERROR_ISSUE_STATUS)[keyof typeof ERROR_ISSUE_STATUS];

export const ERROR_ISSUE_STATUS_OPTIONS = [
  { label: "Abierto", value: ERROR_ISSUE_STATUS.OPEN },
  { label: "Resuelto", value: ERROR_ISSUE_STATUS.RESOLVED },
  { label: "Ignorado", value: ERROR_ISSUE_STATUS.IGNORED },
] as const;

export const ERROR_ISSUE_STATUS_VALUES: ReadonlySet<string> = new Set(
  Object.values(ERROR_ISSUE_STATUS),
);
