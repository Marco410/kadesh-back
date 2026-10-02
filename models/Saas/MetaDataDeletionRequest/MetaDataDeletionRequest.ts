import { list } from "@keystone-6/core";
import { select, text, timestamp } from "@keystone-6/core/fields";
import { metaDataDeletionRequestAccess } from "./MetaDataDeletionRequest.access";
import {
  META_DATA_DELETION_STATUS_OPTIONS,
  MetaDataDeletionStatus,
} from "./constants";

export default list({
  access: metaDataDeletionRequestAccess,
  ui: {
    label: "Eliminación de datos (Meta)",
    listView: {
      initialColumns: ["confirmationCode", "status", "requestedAt", "completedAt"],
    },
  },
  fields: {
    metaUserId: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: {
        description: "App-scoped user id que Meta manda en el signed_request (user_id).",
      },
    }),
    confirmationCode: text({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: {
        description: "Código público para consultar el estado. No es un dato de Meta.",
      },
    }),
    status: select({
      type: "string",
      options: META_DATA_DELETION_STATUS_OPTIONS,
      defaultValue: MetaDataDeletionStatus.PENDING,
      validation: { isRequired: true },
      isIndexed: true,
      ui: { displayMode: "select" },
    }),
    requestedAt: timestamp({
      validation: { isRequired: true },
      defaultValue: { kind: "now" },
      ui: { description: "Cuándo llegó el callback de Meta." },
    }),
    completedAt: timestamp({
      db: { isNullable: true },
      ui: { description: "Cuándo se marcó completed. Vacío si sigue pending o failed." },
    }),
    notes: text({
      db: { isNullable: true },
      ui: {
        displayMode: "textarea",
        description: "Nota interna. No se expone en el endpoint público de estado.",
      },
    }),
  },
});
