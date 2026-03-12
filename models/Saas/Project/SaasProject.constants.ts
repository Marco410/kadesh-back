
export const PROJECT_STATUS = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  EN_REVISION: "En revisión",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
} as const;

export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS).map(
  ([, value]) => ({ label: value, value })
);
