export const ANIMAL_COMMENT_KIND = {
  COMMENT: "comment",
  DUPLICATE_REPORT: "duplicate_report",
  POSSIBLE_MATCH: "possible_match",
} as const;

export type AnimalCommentKind = (typeof ANIMAL_COMMENT_KIND)[keyof typeof ANIMAL_COMMENT_KIND];

export const ANIMAL_COMMENT_KIND_OPTIONS = [
  { label: "Comentario", value: ANIMAL_COMMENT_KIND.COMMENT },
  { label: "También lo reportó", value: ANIMAL_COMMENT_KIND.DUPLICATE_REPORT },
  { label: "Posible coincidencia", value: ANIMAL_COMMENT_KIND.POSSIBLE_MATCH },
];
