import { list } from "@keystone-6/core";
import {
  text,
  integer,
  timestamp,
  relationship,
  checkbox,
  json,
  select,
} from "@keystone-6/core/fields";
import { userAuthLogAccess } from "./UserAuthLog.access";
import { USER_AUTH_LOG_SOURCE } from "./constants";

export default list({
  access: userAuthLogAccess,
  ui: {
    listView: {
      initialColumns: [
        "createdAt",
        "source",
        "step",
        "success",
        "emailMasked",
        "user",
        "message",
      ],
    },
  },
  fields: {
    user: relationship({
      ref: "User.authLogs",
      many: false,
      ui: { description: "Usuario afectado (vacío si falló antes de crear cuenta)" },
    }),
    source: select({
      type: "string",
      options: [
        { label: "registerUser", value: USER_AUTH_LOG_SOURCE.REGISTER_USER },
        { label: "customAuth", value: USER_AUTH_LOG_SOURCE.CUSTOM_AUTH },
      ],
      ui: { description: "Mutación / flujo" },
    }),
    step: text({
      isIndexed: true,
      ui: { description: "Código de resultado (USER_AUTH_LOG_STEP)" },
    }),
    success: checkbox({
      defaultValue: false,
    }),
    message: text({
      ui: { displayMode: "textarea", description: "Mensaje o error (sin datos sensibles)" },
    }),
    emailMasked: text({
      ui: { description: "Email del intento (enmascarado)" },
    }),
    responseSnapshot: json({
      ui: { description: "Payload devuelto o metadatos (sin tokens)" },
    }),
    durationMs: integer({
      db: { isNullable: true },
      ui: { description: "Duración del intento en ms" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: { description: "Momento del evento" },
    }),
  },
});
