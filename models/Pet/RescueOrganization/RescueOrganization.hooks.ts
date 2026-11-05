import type { KeystoneContext } from "@keystone-6/core/types";
import { ACTIVITY_EVENT } from "../../../models/ActivityEvent/constants";
import { NOTIFICATION_TYPE } from "../../../models/Notification/constants";
import { logActivity } from "../../../utils/activity/logActivity";
import { notify } from "../../../utils/notifications/notify";
import { RESCUE_MEMBER_ROLE, RESCUE_ORG_STATUS, RESCUE_ORG_STATUS_OPTIONS } from "./constants";
import { rescueStaffIds } from "./RescueOrganization.access";
import { buildRescueSlug, normalizeRescueOrgProfile, uniqueRescueSlug } from "./RescueOrganization.rules";

/**
 * Hooks de `RescueOrganization`:
 * - limpia el perfil (teléfono, links, textos) venga de la web, del admin o de una mutación;
 * - pone el slug al crear y las fechas de verificación y de aliado;
 * - una organización que deja de estar verificada deja de ser aliada;
 * - avisa a su equipo cuando un admin la verifica, la rechaza o la suspende.
 */

type HookArgs = {
  operation: string;
  resolvedData: Record<string, any>;
  item?: Record<string, any> | null;
  originalItem?: Record<string, any> | null;
  context: KeystoneContext;
  addValidationError?: (message: string) => void;
};

const STATUS_LABEL = Object.fromEntries(RESCUE_ORG_STATUS_OPTIONS.map((option) => [option.value, option.label]));

function rescuePanelUrl(organizationId: string) {
  const base = (process.env.PET_FRONTEND_URL?.trim() || process.env.FRONTEND_URL?.trim() || "https://pet.kadesh.com.mx")
    .replace(/\/+$/, "");
  return `${base}/perfil?tab=rescate&org=${encodeURIComponent(organizationId)}`;
}

export async function resolveRescueOrgInput({ operation, resolvedData, item, context }: HookArgs) {
  const { data } = normalizeRescueOrgProfile(resolvedData);

  if (operation === "create" && !data.slug) {
    data.slug = await uniqueRescueSlug(context, buildRescueSlug(String(data.name ?? ""), data.city ?? null));
  } else if (typeof data.slug === "string") {
    const clean = data.slug.trim().toLowerCase();
    data.slug = clean ? await uniqueRescueSlug(context, clean, item?.id ? String(item.id) : undefined) : item?.slug;
  }

  if ("status" in data && data.status === RESCUE_ORG_STATUS.VERIFIED && !item?.verifiedAt && !data.verifiedAt) {
    data.verifiedAt = new Date().toISOString();
  }
  // Al dejar de estar verificada, sale de la portada de aliados.
  if ("status" in data && data.status !== RESCUE_ORG_STATUS.VERIFIED && item?.isAlly && data.isAlly !== true) {
    data.isAlly = false;
  }
  if ("isAlly" in data) {
    if (data.isAlly && !item?.allySince && !data.allySince) data.allySince = new Date().toISOString();
    if (data.isAlly === false) data.allySince = null;
  }
  return data;
}

export async function validateRescueOrgInput({ resolvedData, item, addValidationError }: HookArgs) {
  const { errors } = normalizeRescueOrgProfile(resolvedData);
  for (const message of errors) addValidationError?.(message);
  const status = resolvedData.status ?? item?.status;
  const isAlly = resolvedData.isAlly ?? item?.isAlly;
  if (isAlly && status !== RESCUE_ORG_STATUS.VERIFIED) {
    addValidationError?.("Solo una organización verificada puede ser aliada.");
  }
}

/** Aviso y actividad cuando un admin cambia el estado (desde el admin de Keystone o con sudo). */
export async function afterRescueOrgOperation({ operation, item, originalItem, context }: HookArgs) {
  if (operation !== "update" || !item?.id) return;
  const before = originalItem?.status;
  const after = item.status;
  if (!after || before === after) return;

  void logActivity(context, {
    type: ACTIVITY_EVENT.PET_RESCUE_STATUS_CHANGED,
    summary: `Cambió el espacio de rescate "${String(item.name ?? "").slice(0, 80)}" a ${STATUS_LABEL[after] ?? after}`,
    entityType: "RescueOrganization",
    entityId: String(item.id),
    metadata: { from: before ?? null, to: after },
  });

  const verified = after === RESCUE_ORG_STATUS.VERIFIED;
  const closed = after === RESCUE_ORG_STATUS.REJECTED || after === RESCUE_ORG_STATUS.SUSPENDED;
  if (!verified && !closed) return;
  const audience = await rescueStaffIds(context, String(item.id), [RESCUE_MEMBER_ROLE.ADMIN]);
  if (!audience.length) return;
  const note = String(item.statusNote ?? "").trim();
  void notify(context, {
    audience,
    product: "pet",
    type: verified ? NOTIFICATION_TYPE.RESCUE_VERIFIED : NOTIFICATION_TYPE.RESCUE_REJECTED,
    title: verified
      ? `¡${item.name} ya está verificado!`
      : after === RESCUE_ORG_STATUS.SUSPENDED
        ? `Suspendimos el espacio ${item.name}`
        : `No pudimos verificar ${item.name}`,
    body: verified
      ? "Tu perfil ya es público y tus animales muestran el nombre de tu organización."
      : note || "Escríbenos por WhatsApp para revisar tu caso.",
    entityType: "RescueOrganization",
    entityId: String(item.id),
    url: rescuePanelUrl(String(item.id)),
    metadata: { status: after, slug: item.slug ?? null },
  });
}
