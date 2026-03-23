import { list } from "@keystone-6/core";
import {
  text,
  timestamp,
  checkbox,
  select,
} from "@keystone-6/core/fields";
import { systemReleaseAccess } from "./systemRelease.access";
import { SYSTEM_RELEASE_PRODUCT_OPTIONS } from "./constants";

export default list({
  access: systemReleaseAccess,
  ui: {
    labelField: "version",
    listView: {
      initialColumns: [
        "version",
        "product",
        "title",
        "releasedAt",
        "isPublished",
        "createdAt",
      ],
    },
  },
  fields: {
    version: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "Versión semver o etiqueta (ej. 1.4.0)" },
    }),
    product: select({
      options: SYSTEM_RELEASE_PRODUCT_OPTIONS,
      validation: { isRequired: true },
      ui: {
        displayMode: "select",
        description: "Pet, SaaS o ambas apps",
      },
    }),
    title: text({
      ui: { description: "Título corto del release (opcional)" },
    }),
    body: text({
      ui: {
        displayMode: "textarea",
        description: "Notas de cambio (texto o markdown según el front)",
      },
    }),
    releasedAt: timestamp({
      validation: { isRequired: true },
      ui: { description: "Fecha en que aplica / se publica el release" },
    }),
    isPublished: checkbox({
      defaultValue: false,
      ui: { description: "Si está desmarcado, solo admins lo ven en listados" },
    }),
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
});
