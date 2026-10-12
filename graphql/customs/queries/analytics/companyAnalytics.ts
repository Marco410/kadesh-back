import type { KeystoneContext } from "@keystone-6/core/types";
import { GraphQLError } from "graphql";
import { hasPermission, hasRole } from "../../../../auth/permissions";
import { PERMISSION_KEYS } from "../../../../auth/permissionsCatalog";
import { Role } from "../../../../models/Role/constants";
import { isPlatformAdmin, getSessionCompanyId, getSessionUserId } from "../../../../utils/access/tenant";
import { computeSalesVelocity } from "../../../../utils/analytics/salesVelocity";
import { PLAN_FEATURE, companyHasPlanFeature } from "../../../../utils/saas/planFeatures";
import { crmCompanyScope } from "../admin/shared";

/**
 * Analítica de ventas para el cliente (módulo de pago `analytics`). Siempre de la empresa de la
 * sesión: no recibe empresa por argumento. Quien tiene "Ver la analítica de todo el equipo"
 * (admin de la empresa y Gerencia por defecto) ve a todos; los demás, solo los leads que tienen
 * asignados. La regla de cálculo es la misma que ve Kadesh en Operaciones.
 */

const STALLED_LIMIT = 50;

const typeDefs = `
  input CompanyAnalyticsInput {
    """Últimos N días (30–365, por defecto 90)."""
    days: Int
  }

  type CompanyStageVelocity {
    stage: String!
    entered: Int!
    advanced: Int!
    lost: Int!
    medianDays: Float
    stalled: Int!
  }

  type CompanySellerVelocity {
    """Vacío = leads sin vendedor asignado."""
    userId: ID
    name: String!
    entered: Int!
    contacted: Int!
    contactedWithin2Days: Int!
    won: Int!
    lost: Int!
    winRate: Float
    medianCycleDays: Float
    medianFirstContactHours: Float
    stalled: Int!
    """Actividades que registró en el periodo."""
    activities: Int!
    """WhatsApp que mandó en el periodo."""
    whatsappSent: Int!
  }

  type CompanyStalledDeal {
    businessLeadId: ID
    leadName: String!
    stage: String!
    """Desde cuándo está en esa etapa."""
    since: String!
    days: Int!
    sellerName: String
  }

  type CompanyAnalytics {
    """team (todo el equipo) | own (solo sus leads)"""
    scope: String!
    days: Int!
    dataSince: String
    stages: [CompanyStageVelocity!]!
    won: Int!
    lost: Int!
    winRate: Float
    wonValue: Float!
    medianCycleDays: Float
    cycleSample: Int!
    newLeads: Int!
    contacted: Int!
    contactedWithin2Days: Int!
    medianFirstContactHours: Float
    stalled: Int!
    whatsappInbound: Int!
    whatsappAnswered: Int!
    whatsappAnsweredWithin1h: Int!
    whatsappMedianResponseMinutes: Float
    whatsappConversations: Int!
    whatsappReplied: Int!
    """Solo con permiso de ver al equipo."""
    sellers: [CompanySellerVelocity!]!
    stalledDeals: [CompanyStalledDeal!]!
  }

  type Query {
    companyAnalytics(input: CompanyAnalyticsInput): CompanyAnalytics!
  }
`;

const definition = `
  companyAnalytics(input: CompanyAnalyticsInput): CompanyAnalytics!
`;

const fail = (message: string, code: string) =>
  new GraphQLError(message, { extensions: { code, http: { status: 200 } } });

const clampDays = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(365, Math.max(30, Math.floor(value))) : 90;

const fullName = (user: { name?: string | null; lastName?: string | null } | undefined) =>
  [user?.name, user?.lastName].filter(Boolean).join(" ").trim() || "Sin nombre";

const resolver = {
  companyAnalytics: async (
    _root: unknown,
    { input }: { input?: { days?: number | null } | null },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    const userId = getSessionUserId(session as never);
    const companyId = getSessionCompanyId(session as never);
    if (!userId) throw fail("Inicia sesión para ver la analítica.", "UNAUTHENTICATED");
    if (!companyId) throw fail("Tu cuenta no tiene empresa.", "NO_COMPANY");
    if (!hasPermission(session, PERMISSION_KEYS.ANALITICA_VER, () => true)) {
      throw fail("No tienes permiso para ver la analítica. Pídeselo al administrador de tu empresa.", "FORBIDDEN");
    }
    if (!isPlatformAdmin(session as never) && !(await companyHasPlanFeature(context, companyId, PLAN_FEATURE.ANALYTICS))) {
      throw fail("Tu plan no incluye Analítica. Mejora tu plan para verla.", "FEATURE_LOCKED");
    }

    const seesTeam = hasPermission(session, PERMISSION_KEYS.ANALITICA_VER_EQUIPO, () =>
      hasRole(session, [Role.GERENCIA]),
    );
    const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
    const days = clampDays(input?.days);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const velocity = await computeSalesVelocity(prisma, {
      days,
      companyWhere: companyId,
      salesPersonId: seesTeam ? null : userId,
      bySeller: seesTeam,
    });

    // Nombres: vendedores (con su actividad del periodo) y leads estancados.
    const stalled = velocity.stalledDeals.slice(0, STALLED_LIMIT);
    const [activityGroups, whatsappGroups, people, leads] = await Promise.all([
      seesTeam
        ? prisma.techSalesActivity.groupBy({
            by: ["createdById"],
            where: { createdAt: { gte: since }, ...crmCompanyScope(companyId) },
            _count: { _all: true },
          })
        : [],
      seesTeam
        ? prisma.techWhatsAppMessage.groupBy({
            by: ["sentById"],
            where: { companyId, createdAt: { gte: since }, direction: { not: "inbound" } },
            _count: { _all: true },
          })
        : [],
      prisma.user.findMany({
        where: {
          id: {
            in: [...velocity.bySeller.keys(), ...stalled.map((deal) => deal.salesPersonId ?? "")].filter(Boolean),
          },
        },
        select: { id: true, name: true, lastName: true },
      }),
      prisma.techBusinessLead.findMany({
        where: { id: { in: stalled.map((deal) => deal.businessLeadId ?? "").filter(Boolean) } },
        select: { id: true, businessName: true },
      }),
    ]);
    const personById = new Map((people as Array<{ id: string; name: string; lastName: string | null }>).map((p) => [p.id, p]));
    const leadName = new Map((leads as Array<{ id: string; businessName: string }>).map((l) => [l.id, l.businessName]));
    const countBy = (groups: unknown, field: string) =>
      new Map(
        (Array.isArray(groups) ? groups : []).map((row: Record<string, any>) => [row[field] ?? "", row._count._all as number]),
      );
    const activitiesBy = countBy(activityGroups, "createdById");
    const whatsappBy = countBy(whatsappGroups, "sentById");

    const sellers = seesTeam
      ? [...velocity.bySeller.entries()]
          .map(([id, stats]) => ({
            userId: id || null,
            name: id ? fullName(personById.get(id)) : "Sin vendedor",
            ...stats,
            activities: id ? activitiesBy.get(id) ?? 0 : 0,
            whatsappSent: id ? whatsappBy.get(id) ?? 0 : 0,
          }))
          .sort((a, b) => b.entered + b.won - (a.entered + a.won))
      : [];

    const { byCompany: _company, bySeller: _seller, stalledDeals: _deals, dataSince, ...totals } = velocity;
    return {
      ...totals,
      scope: seesTeam ? "team" : "own",
      dataSince: dataSince ? dataSince.toISOString() : null,
      sellers,
      stalledDeals: stalled.map((deal) => ({
        businessLeadId: deal.businessLeadId,
        leadName: (deal.businessLeadId && leadName.get(deal.businessLeadId)) || "Lead",
        stage: deal.stage,
        since: deal.since.toISOString(),
        days: deal.days,
        sellerName: deal.salesPersonId ? fullName(personById.get(deal.salesPersonId)) : null,
      })),
    };
  },
};

export default { typeDefs, definition, resolver };
