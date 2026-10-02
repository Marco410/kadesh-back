/** Estado de una solicitud de eliminación de datos pedida por Meta. */
export enum MetaDataDeletionStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
}

export const META_DATA_DELETION_STATUS_OPTIONS = [
  { label: "Pendiente", value: MetaDataDeletionStatus.PENDING },
  { label: "Completada", value: MetaDataDeletionStatus.COMPLETED },
  { label: "Fallida", value: MetaDataDeletionStatus.FAILED },
];
