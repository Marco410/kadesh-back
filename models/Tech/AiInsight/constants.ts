export const AI_INSIGHT_KIND = {
  DAILY_DIGEST: "daily_digest",
  MONTHLY_NARRATIVE: "monthly_narrative",
  FILE_ANALYSIS: "file_analysis",
  PROFILE_PLAYBOOK: "profile_playbook",
} as const;

export type AiInsightKind =
  (typeof AI_INSIGHT_KIND)[keyof typeof AI_INSIGHT_KIND];

export const AI_INSIGHT_KIND_OPTIONS = [
  { label: "Digest diario", value: AI_INSIGHT_KIND.DAILY_DIGEST },
  { label: "Narrativa mensual", value: AI_INSIGHT_KIND.MONTHLY_NARRATIVE },
  { label: "Análisis de archivo", value: AI_INSIGHT_KIND.FILE_ANALYSIS },
  { label: "Playbook de perfil", value: AI_INSIGHT_KIND.PROFILE_PLAYBOOK },
] as const;
