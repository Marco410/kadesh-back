/** Qué se puede reportar desde la app. */
export const REPORTABLE = {
  ANIMAL: "Animal",
  ANIMAL_COMMENT: "AnimalComment",
  POST_COMMENT: "PostComment",
  USER: "User",
} as const;

export type ReportableType = (typeof REPORTABLE)[keyof typeof REPORTABLE];

export const REPORTABLE_OPTIONS = [
  { label: "Reporte de animal", value: REPORTABLE.ANIMAL },
  { label: "Comentario en un animal", value: REPORTABLE.ANIMAL_COMMENT },
  { label: "Comentario en el blog", value: REPORTABLE.POST_COMMENT },
  { label: "Persona", value: REPORTABLE.USER },
];

export const REPORT_REASON = {
  SPAM: "spam",
  OFFENSIVE: "offensive",
  SCAM: "scam",
  ANIMAL_ABUSE: "animal_abuse",
  OTHER: "other",
} as const;

export const REPORT_REASON_OPTIONS = [
  { label: "Spam o publicidad", value: REPORT_REASON.SPAM },
  { label: "Ofensivo o acoso", value: REPORT_REASON.OFFENSIVE },
  { label: "Fraude o engaño", value: REPORT_REASON.SCAM },
  { label: "Maltrato animal", value: REPORT_REASON.ANIMAL_ABUSE },
  { label: "Otro", value: REPORT_REASON.OTHER },
];

export const REPORT_STATUS = {
  OPEN: "open",
  RESOLVED: "resolved",
  DISMISSED: "dismissed",
} as const;

export const REPORT_STATUS_OPTIONS = [
  { label: "Abierto", value: REPORT_STATUS.OPEN },
  { label: "Resuelto (se quitó el contenido)", value: REPORT_STATUS.RESOLVED },
  { label: "Descartado", value: REPORT_STATUS.DISMISSED },
];
