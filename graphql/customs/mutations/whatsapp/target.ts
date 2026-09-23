import { KeystoneContext } from "@keystone-6/core/types";
import {
  getSessionCompanyId,
  getSessionUserId,
} from "../../../../utils/access/tenant";
import { canUseCompanyWhatsapp, denyCompanyWhatsappUseMessage } from "./access";

export type WhatsAppTargetArgs = {
  businessLeadId?: string | null;
  teamMemberId?: string | null;
};

export type ResolvedWhatsAppTarget = {
  companyId: string;
  /** Teléfono ya normalizado a dígitos con lada. */
  to: string;
  /** Nombre para plantillas y mensajes de error. */
  displayName: string;
  /** Relaciones que lleva cada TechWhatsAppMessage de esta conversación. */
  link: Record<string, unknown>;
};

/** Mismo criterio que `whatsappDigitsFromPhone` del front (DetailLeadSection.tsx): sin
 * +/espacios/guiones, y si son 10 dígitos (formato local MX) se asume lada 52. */
export function normalizeWhatsAppDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

/**
 * Resuelve el destinatario de un mensaje: un lead del CRM o alguien del propio equipo (chat
 * interno). Devuelve `error` en vez de lanzar, para que cada mutación lo regrese como
 * `{ success: false, message }` igual que el resto del módulo.
 *
 * Acceso: para un lead se consulta **sin sudo**, así el filtro del list
 * (`leadCompanyScopedWhere`) hace que un vendedor no pueda escribirle a un lead que no tiene
 * asignado — mismo criterio con el que ve los chats. Para un compañero de equipo sí se usa
 * sudo (un vendedor no puede leer el perfil de otro) y se valida a mano que sea de su empresa.
 */
export async function resolveWhatsAppTarget(
  { businessLeadId, teamMemberId }: WhatsAppTargetArgs,
  context: KeystoneContext,
): Promise<{ target?: ResolvedWhatsAppTarget; error?: string }> {
  const session = context.session;
  const sessionCompanyId = getSessionCompanyId(session);
  const sessionUserId = getSessionUserId(session);

  const hasLead = Boolean(businessLeadId);
  const hasTeamMember = Boolean(teamMemberId);
  if (hasLead === hasTeamMember) {
    return { error: "Indica un lead o un miembro del equipo (uno de los dos)" };
  }

  if (hasTeamMember) {
    const user = await context.sudo().query.User.findOne({
      where: { id: teamMemberId as string },
      query: "id name lastName phone company { id }",
    });
    if (!user) return { error: "No se encontró a esa persona" };

    const userCompanyId: string | null = user.company?.id ?? null;
    if (
      !userCompanyId ||
      userCompanyId !== sessionCompanyId ||
      !canUseCompanyWhatsapp(session, userCompanyId)
    ) {
      return { error: denyCompanyWhatsappUseMessage(session) };
    }

    const to = user.phone ? normalizeWhatsAppDigits(user.phone) : null;
    if (!to) {
      return {
        error: "Esta persona no tiene un teléfono válido en su perfil",
      };
    }

    // Si el hilo interno ya existe se conserva a quien lo abrió, para no cambiarle de dueño la
    // conversación a media plática (ver whatsappMessageScopedWhere: lo ven el teamMember y el
    // iniciador).
    const [latest] = (await context.sudo().query.TechWhatsAppMessage.findMany({
      where: {
        company: { id: { equals: userCompanyId } },
        teamMember: { id: { equals: teamMemberId as string } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 1,
      query: "id internalInitiator { id }",
    })) as Array<{ internalInitiator: { id: string } | null }>;

    const initiatorId = latest?.internalInitiator?.id ?? sessionUserId ?? null;

    return {
      target: {
        companyId: userCompanyId,
        to,
        displayName:
          [user.name, user.lastName].filter(Boolean).join(" ") || "tu compañero(a)",
        link: {
          teamMember: { connect: { id: teamMemberId as string } },
          ...(initiatorId
            ? { internalInitiator: { connect: { id: initiatorId } } }
            : {}),
        },
      },
    };
  }

  const lead = await context.query.TechBusinessLead.findOne({
    where: { id: businessLeadId as string },
    query: "id phone businessName saasCompany { id }",
  });
  if (!lead) {
    return { error: "No se encontró el lead, o no está asignado a ti" };
  }

  const leadCompanyIds: string[] = (lead.saasCompany ?? []).map(
    (c: { id: string }) => c.id,
  );
  const companyId =
    sessionCompanyId && leadCompanyIds.includes(sessionCompanyId)
      ? sessionCompanyId
      : null;

  if (!companyId || !canUseCompanyWhatsapp(session, companyId)) {
    return { error: denyCompanyWhatsappUseMessage(session) };
  }

  const to = lead.phone ? normalizeWhatsAppDigits(lead.phone) : null;
  if (!to) return { error: "Este lead no tiene un teléfono válido" };

  return {
    target: {
      companyId,
      to,
      displayName: lead.businessName?.trim() || "estimado(a)",
      link: { businessLead: { connect: { id: businessLeadId as string } } },
    },
  };
}
