import { graphql, list } from "@keystone-6/core";
import {
  checkbox,
  image,
  integer,
  multiselect,
  relationship,
  select,
  text,
  timestamp,
  virtual,
} from "@keystone-6/core/fields";
import type { KeystoneContext } from "@keystone-6/core/types";
import { getSessionUserId } from "../../../utils/access/tenant";
import { ANIMAL_TYPE_OPTIONS } from "../../../utils/constants/constants";
import {
  RESCUE_ORG_STATUS,
  RESCUE_ORG_STATUS_OPTIONS,
  RESCUE_ORG_TYPE,
  RESCUE_ORG_TYPE_OPTIONS,
} from "./constants";
import { EMPTY_IMPACT, type RescueImpact, rescueImpactByOrg } from "./impact";
import {
  findRescueMemberRole,
  rescueAdminReadField,
  rescueAdminWriteField,
  rescueOrganizationAccess,
} from "./RescueOrganization.access";
import { afterRescueOrgOperation, resolveRescueOrgInput, validateRescueOrgInput } from "./RescueOrganization.hooks";

/** Una sola consulta por organización y petición, aunque se pidan los tres conteos. */
const impactMemo = new WeakMap<object, Map<string, Promise<RescueImpact>>>();

function impactOf(item: any, context: KeystoneContext): Promise<RescueImpact> {
  if (!item?.id) return Promise.resolve(EMPTY_IMPACT);
  const id = String(item.id);
  let perRequest = impactMemo.get(context);
  if (!perRequest) {
    perRequest = new Map();
    impactMemo.set(context, perRequest);
  }
  let pending = perRequest.get(id);
  if (!pending) {
    pending = rescueImpactByOrg(context, [id]).then((map) => map.get(id) ?? EMPTY_IMPACT);
    perRequest.set(id, pending);
  }
  return pending;
}

function impactField(key: keyof RescueImpact, description: string) {
  return virtual({
    field: graphql.field({
      type: graphql.nonNull(graphql.Int),
      async resolve(item: any, _args, context: KeystoneContext) {
        return (await impactOf(item, context))[key];
      },
    }),
    ui: { description, listView: { fieldMode: "hidden" } },
  });
}

/**
 * Espacio de rescate: rescatista independiente, refugio, hogar temporal, colectivo o asociación.
 * Lo activa una persona desde el panel (`activateRescueOrganization`) y queda «En revisión» hasta que
 * un admin lo verifica aquí. El equipo vive en `RescueOrganizationMember`; los animales que publica
 * a su nombre, en `Animal.organization`. Ver README.md.
 */
export default list({
  access: rescueOrganizationAccess,
  hooks: {
    resolveInput: resolveRescueOrgInput as any,
    validateInput: validateRescueOrgInput as any,
    afterOperation: afterRescueOrgOperation as any,
  },
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["name", "type", "city", "status", "isAlly", "createdAt"],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({
      isIndexed: "unique",
      db: { isNullable: true },
      access: rescueAdminWriteField,
      ui: { description: "URL del perfil (/organizaciones/<slug>). Se genera sola al crearla." },
    }),
    type: select({
      type: "string",
      options: RESCUE_ORG_TYPE_OPTIONS,
      defaultValue: RESCUE_ORG_TYPE.INDEPENDENT,
      validation: { isRequired: true },
    }),
    description: text({ ui: { displayMode: "textarea" } }),
    logo: image({ storage: "s3_rescue" }),
    cover: image({ storage: "s3_rescue" }),
    city: text(),
    state: text(),
    species: multiselect({
      type: "string",
      // Los mismos tipos que un reporte (`AnimalType`), para que coincidan con sus animales.
      options: ANIMAL_TYPE_OPTIONS,
      defaultValue: [],
      ui: { description: "Qué animales rescata (vacío = cualquiera)" },
    }),
    capacity: integer({ ui: { description: "Cuántos animales puede tener a la vez (opcional)" } }),
    whatsapp: text({ ui: { description: "Contacto público, 10 dígitos" } }),
    email: text(),
    websiteUrl: text(),
    facebookUrl: text(),
    instagramUrl: text(),
    tiktokUrl: text(),
    donationUrl: text({ ui: { description: "Link para donar (PayPal, Mercado Pago, etc.)" } }),
    donationInfo: text({ ui: { displayMode: "textarea", description: "Datos para donar que la organización quiere mostrar" } }),
    needs: text({ ui: { displayMode: "textarea", description: "Lo que necesita: croquetas, medicinas, cobijas…" } }),

    status: select({
      type: "string",
      options: RESCUE_ORG_STATUS_OPTIONS,
      defaultValue: RESCUE_ORG_STATUS.PENDING,
      isIndexed: true,
      validation: { isRequired: true },
      access: rescueAdminWriteField,
      ui: { description: "En revisión hasta validarla por WhatsApp. Solo las verificadas son públicas." },
    }),
    statusNote: text({
      access: rescueAdminWriteField,
      ui: { displayMode: "textarea", description: "Motivo del rechazo o suspensión (lo ve su equipo)" },
    }),
    verifiedAt: timestamp({
      db: { isNullable: true },
      access: rescueAdminWriteField,
      ui: { itemView: { fieldMode: "read" } },
    }),
    isAlly: checkbox({
      defaultValue: false,
      access: rescueAdminWriteField,
      ui: { description: "Aliado KADESH: sale en la portada y en /aliados. Solo organizaciones verificadas." },
    }),
    allySince: timestamp({
      db: { isNullable: true },
      access: rescueAdminWriteField,
      ui: { itemView: { fieldMode: "read" } },
    }),
    allyOrder: integer({
      access: rescueAdminWriteField,
      ui: { description: "Orden manual en la portada (1 primero). Vacío = por impacto." },
    }),
    adminNotes: text({
      access: rescueAdminReadField,
      ui: { displayMode: "textarea", description: "Notas internas del equipo de Kadesh" },
    }),
    createdBy: relationship({
      ref: "User",
      many: false,
      access: rescueAdminReadField,
      ui: { description: "Quién activó el espacio" },
    }),

    members: relationship({ ref: "RescueOrganizationMember.organization", many: true }),
    animals: relationship({
      ref: "Animal.organization",
      many: true,
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
    }),

    publishedCount: impactField("animals", "Animales publicados a su nombre (sin repetidos)"),
    adoptedCount: impactField("adopted", "Animales que ya tienen hogar"),
    inAdoptionCount: impactField("inAdoption", "Animales en adopción ahora"),
    /** Rol de quien consulta en la organización (`admin`, `coordinator`…), o null. */
    viewerRole: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _args, context: KeystoneContext) {
          const userId = getSessionUserId(context.session);
          if (!userId || !item?.id) return null;
          return findRescueMemberRole(context, String(item.id), userId);
        },
      }),
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),

    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
    }),
    updatedAt: timestamp({
      db: { updatedAt: true },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
    }),
  },
});
