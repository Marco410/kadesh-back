import type { KeystoneContext } from "@keystone-6/core/types";
import { COMPANY_CREDIT_LEDGER_TYPE } from "../../../../models/Saas/SaasCompanyCreditLedger/constants";
import { SAAS_SUBSCRIPTION_LOG_STEP } from "../../../../models/Saas/SaasSubscriptionLog/constants";
import { USER_AUTH_LOG_STEP } from "../../../../models/User/UserAuthLog/constants";
import {
  ACTIVITY_SOURCE,
  FEED_HIDDEN_EVENT_TYPES,
} from "../../../../models/ActivityEvent/constants";
import { AI_FEATURE } from "../../../../utils/ai/constants";
import {
  PERSON_SELECT,
  adminPrisma,
  assertPlatformAdmin,
  clampInt,
  crmCompanyScope,
  insensitive,
  personRef,
} from "./shared";

/**
 * Feed de actividad de Operaciones. Une los logs que ya existen y `ActivityEvent` (Fase 2)
 * en una sola línea de tiempo.
 * Pagina por cursor (`before` = fecha del último item) porque mezcla varias tablas.
 * Nunca devuelve prompts de IA, cuerpos de WhatsApp ni contraseñas.
 */

const FEED_TYPES = [
  "auth",
  "extraction",
  "crm",
  "team",
  "ai",
  "credits",
  "billing",
  "whatsapp",
  "calendar",
  "admin",
  "product",
] as const;
type FeedType = (typeof FEED_TYPES)[number];

/** Sin filtro de tipo se muestra todo menos la navegación (vistas de secciones): es mucho volumen. */
const DEFAULT_FEED_TYPES = FEED_TYPES.filter((type) => type !== "product");

const typeDefs = `
  input AdminActivityFeedInput {
    companyId: ID
    userId: ID
    """auth | extraction | crm | team | ai | credits | billing | whatsapp | calendar | admin | product (navegación; solo si se pide)"""
    types: [String!]
    onlyErrors: Boolean
    search: String
    """Cursor: devuelve lo ocurrido antes de esta fecha (ISO)."""
    before: String
    take: Int
  }

  type AdminActivityItem {
    id: ID!
    type: String!
    kind: String!
    occurredAt: String!
    title: String!
    detail: String
    success: Boolean!
    actor: AdminPersonRef
    company: AdminCompanyRef
    entityType: String
    entityId: String
    meta: JSON
  }

  type AdminActivityFeedResult {
    items: [AdminActivityItem!]!
    nextBefore: String
    hasMore: Boolean!
  }

  type Query {
    adminActivityFeed(input: AdminActivityFeedInput): AdminActivityFeedResult!
  }
`;

const definition = `
  adminActivityFeed(input: AdminActivityFeedInput): AdminActivityFeedResult!
`;

type Input = {
  companyId?: string | null;
  userId?: string | null;
  types?: string[] | null;
  onlyErrors?: boolean | null;
  search?: string | null;
  before?: string | null;
  take?: number | null;
};

type Person = { id: string; name?: string | null; lastName?: string | null; email?: string | null };
type CompanyRef = { id: string; name: string };

type FeedItem = {
  id: string;
  type: FeedType;
  kind: string;
  occurredAt: Date;
  title: string;
  detail: string | null;
  success: boolean;
  actor: Person | null;
  company: CompanyRef | null;
  entityType: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
};

type SourceCtx = {
  prisma: any;
  companyId: string | null;
  userId: string | null;
  onlyErrors: boolean;
  search: string | null;
  before: Date | null;
  take: number;
  types: Set<FeedType>;
};

const COMPANY_SELECT = { select: { id: true, name: true } } as const;
const PERSON_WITH_COMPANY = {
  select: { ...PERSON_SELECT, company: COMPANY_SELECT },
} as const;

const AI_FEATURE_LABELS: Record<string, string> = {
  [AI_FEATURE.CONNECTION_TEST]: "prueba de conexión",
  [AI_FEATURE.DAILY_DIGEST]: "resumen diario",
  [AI_FEATURE.MONTHLY_NARRATIVE]: "narrativa mensual",
  [AI_FEATURE.FILE_ANALYSIS]: "análisis de archivo",
  [AI_FEATURE.PROFILE_PLAYBOOK]: "playbook de perfil",
  [AI_FEATURE.COMPANY_BRIEF]: "brief de empresa",
  [AI_FEATURE.MARKET_ANALYSIS]: "análisis de mercado",
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  Llamada: "una llamada",
  WhatsApp: "un WhatsApp",
  Email: "un correo",
  Reunión: "una reunión",
  Otra: "una actividad",
};

const CALENDAR_OPERATION_LABELS: Record<string, string> = {
  create: "crear un evento",
  update: "actualizar un evento",
  delete: "borrar un evento",
  list_events: "leer eventos",
  token_refresh: "renovar el acceso",
  list_calendars: "leer calendarios",
};

const SUBSCRIPTION_STEP_LABELS: Record<string, string> = {
  [SAAS_SUBSCRIPTION_LOG_STEP.USER_NOT_FOUND]: "usuario no encontrado",
  [SAAS_SUBSCRIPTION_LOG_STEP.NO_COMPANY]: "sin empresa",
  [SAAS_SUBSCRIPTION_LOG_STEP.NO_PLAN_RESOLVED]: "plan no encontrado",
  [SAAS_SUBSCRIPTION_LOG_STEP.NO_STRIPE_PRICE_ID]: "plan sin precio de Stripe",
  [SAAS_SUBSCRIPTION_LOG_STEP.TOTAL_MISMATCH]: "el total no coincide",
  [SAAS_SUBSCRIPTION_LOG_STEP.PAYMENT_METHOD_NOT_FOUND]: "tarjeta no encontrada",
  [SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_OR_SERVER_ERROR]: "error de Stripe o del servidor",
  [SAAS_SUBSCRIPTION_LOG_STEP.NO_CREDIT_PACKAGE]: "paquete de créditos no encontrado",
  [SAAS_SUBSCRIPTION_LOG_STEP.NO_ACTIVE_SUBSCRIPTION]: "sin suscripción activa",
  [SAAS_SUBSCRIPTION_LOG_STEP.CREDIT_PACKAGE_INACTIVE]: "paquete de créditos apagado",
  [SAAS_SUBSCRIPTION_LOG_STEP.STRIPE_KEY_MISSING]: "Stripe sin configurar",
  [SAAS_SUBSCRIPTION_LOG_STEP.SESSION_MISMATCH]: "sesión de otra cuenta",
};

const PAYMENT_STATUS_TITLES: Record<string, string> = {
  failed: "Cobro rechazado",
  refunded: "Cobro reembolsado",
  cancelled: "Cobro cancelado",
  pending: "Cobro pendiente",
  processing: "Cobro en proceso",
};

function timeFilter(before: Date | null) {
  return before ? { lt: before } : { not: null };
}

function money(amount: number | null | undefined, currency?: string | null) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: (currency || "MXN").toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
}

function joinDetail(parts: Array<string | null | undefined | false>) {
  const text = parts.filter(Boolean).join(" · ");
  return text || null;
}

function personSearch(q: string) {
  return {
    OR: [{ name: insensitive(q) }, { lastName: insensitive(q) }, { email: insensitive(q) }],
  };
}

async function authSource(c: SourceCtx): Promise<FeedItem[]> {
  if (!c.types.has("auth")) return [];
  const where: Record<string, unknown> = { createdAt: timeFilter(c.before) };
  const and: Record<string, unknown>[] = [];
  if (c.userId) where.userId = c.userId;
  if (c.companyId) and.push({ user: { companyId: c.companyId } });
  if (c.onlyErrors) where.success = false;
  if (c.search) {
    and.push({
      OR: [
        { emailMasked: insensitive(c.search) },
        { message: insensitive(c.search) },
        { user: personSearch(c.search) },
      ],
    });
  }
  if (and.length) where.AND = and;

  const rows: Array<{
    id: string;
    source: string | null;
    step: string;
    success: boolean;
    message: string;
    emailMasked: string;
    createdAt: Date;
    user: (Person & { company: CompanyRef | null }) | null;
  }> = await c.prisma.userAuthLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: c.take,
    select: {
      id: true,
      source: true,
      step: true,
      success: true,
      message: true,
      emailMasked: true,
      createdAt: true,
      user: PERSON_WITH_COMPANY,
    },
  });

  return rows.map((row) => {
    const google = row.step.startsWith("GOOGLE");
    let kind = "auth.login";
    let title = google ? "Inició sesión con Google" : "Inició sesión con contraseña";
    switch (row.step) {
      case USER_AUTH_LOG_STEP.REGISTER_SUCCESS:
      case USER_AUTH_LOG_STEP.CUSTOM_AUTH_SIGNUP:
        kind = "auth.signup";
        title = "Se registró";
        break;
      case USER_AUTH_LOG_STEP.GOOGLE_AUTH_SIGNUP:
        kind = "auth.signup";
        title = "Se registró con Google";
        break;
      case USER_AUTH_LOG_STEP.REGISTER_FAIL:
        kind = "auth.signup_failed";
        title = "Falló el registro";
        break;
      case USER_AUTH_LOG_STEP.REGISTER_FAIL_INVALID_REFERRER:
        kind = "auth.signup_failed";
        title = "Registro con código de referido inválido";
        break;
      case USER_AUTH_LOG_STEP.CUSTOM_AUTH_FAIL:
      case USER_AUTH_LOG_STEP.GOOGLE_AUTH_FAIL:
        kind = "auth.login_failed";
        title = google ? "Falló el inicio de sesión con Google" : "Falló el inicio de sesión";
        break;
      default:
        break;
    }
    return {
      id: `auth:${row.id}`,
      type: "auth",
      kind,
      occurredAt: row.createdAt,
      title,
      detail: row.success ? null : joinDetail([row.message, row.user ? null : row.emailMasked]),
      success: row.success,
      actor: row.user,
      company: row.user?.company ?? null,
      entityType: "UserAuthLog",
      entityId: row.id,
      meta: null,
    };
  });
}

async function extractionSource(c: SourceCtx): Promise<FeedItem[]> {
  if (!c.types.has("extraction")) return [];
  const where: Record<string, unknown> = { createdAt: timeFilter(c.before) };
  if (c.companyId) where.companyId = c.companyId;
  if (c.userId) where.userId = c.userId;
  if (c.onlyErrors) where.success = false;
  if (c.search) {
    where.OR = [
      { category: insensitive(c.search) },
      { message: insensitive(c.search) },
      { company: { name: insensitive(c.search) } },
      { user: personSearch(c.search) },
    ];
  }

  const rows: Array<{
    id: string;
    success: boolean;
    message: string;
    created: number | null;
    alreadyInDb: number | null;
    skippedLowRating: number | null;
    syncedLeadsCount: number | null;
    syncedCount: number | null;
    leadLimit: number | null;
    lat: number | null;
    lng: number | null;
    radius: number | null;
    category: string;
    createdAt: Date;
    user: Person | null;
    company: CompanyRef | null;
  }> = await c.prisma.techLeadSyncLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: c.take,
    select: {
      id: true,
      success: true,
      message: true,
      created: true,
      alreadyInDb: true,
      skippedLowRating: true,
      syncedLeadsCount: true,
      syncedCount: true,
      leadLimit: true,
      lat: true,
      lng: true,
      radius: true,
      category: true,
      createdAt: true,
      user: { select: PERSON_SELECT },
      company: COMPANY_SELECT,
    },
  });

  return rows.map((row) => {
    const created = row.created ?? 0;
    const already = row.alreadyInDb ?? 0;
    return {
      id: `extraction:${row.id}`,
      type: "extraction",
      kind: "extraction.run",
      occurredAt: row.createdAt,
      title: row.success
        ? `Extracción: ${created} nuevo${created === 1 ? "" : "s"}${already ? ` · ${already} desde la base` : ""}`
        : "Extracción con error",
      detail: joinDetail([
        row.category || null,
        row.radius != null ? `${row.radius} km` : null,
        row.success ? null : row.message,
      ]),
      success: row.success,
      actor: row.user,
      company: row.company,
      entityType: "TechLeadSyncLog",
      entityId: row.id,
      meta: {
        created,
        alreadyInDb: already,
        skippedLowRating: row.skippedLowRating ?? 0,
        syncedLeadsCount: row.syncedLeadsCount ?? 0,
        syncedCount: row.syncedCount,
        leadLimit: row.leadLimit,
        lat: row.lat,
        lng: row.lng,
        radius: row.radius,
        category: row.category,
        message: row.message || null,
      },
    };
  });
}

async function creditsSource(c: SourceCtx): Promise<FeedItem[]> {
  const ledgerTypes: string[] = [];
  if (c.types.has("credits")) {
    ledgerTypes.push(
      COMPANY_CREDIT_LEDGER_TYPE.GRANT_PLAN,
      COMPANY_CREDIT_LEDGER_TYPE.GRANT_PURCHASE,
      COMPANY_CREDIT_LEDGER_TYPE.ADJUST,
    );
  }
  if (c.types.has("admin")) ledgerTypes.push(COMPANY_CREDIT_LEDGER_TYPE.GRANT_ADMIN);
  // El ledger no tiene fallos ni actor (salvo el admin que agrega créditos).
  if (!ledgerTypes.length || c.onlyErrors) return [];

  const where: Record<string, unknown> = {
    createdAt: timeFilter(c.before),
    type: { in: ledgerTypes },
  };
  if (c.companyId) where.companyId = c.companyId;
  if (c.userId) {
    where.type = COMPANY_CREDIT_LEDGER_TYPE.GRANT_ADMIN;
    where.referenceId = c.userId;
    if (!ledgerTypes.includes(COMPANY_CREDIT_LEDGER_TYPE.GRANT_ADMIN)) return [];
  }
  if (c.search) {
    where.OR = [
      { notes: insensitive(c.search) },
      { company: { name: insensitive(c.search) } },
    ];
  }

  const rows: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number | null;
    referenceType: string | null;
    referenceId: string | null;
    notes: string | null;
    createdAt: Date;
    company: CompanyRef | null;
  }> = await c.prisma.saasCompanyCreditLedger.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: c.take,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      referenceType: true,
      referenceId: true,
      notes: true,
      createdAt: true,
      company: COMPANY_SELECT,
    },
  });

  const adminIds = [
    ...new Set(
      rows
        .filter((r) => r.type === COMPANY_CREDIT_LEDGER_TYPE.GRANT_ADMIN && r.referenceId)
        .map((r) => r.referenceId as string),
    ),
  ];
  const admins: Person[] = adminIds.length
    ? await c.prisma.user.findMany({ where: { id: { in: adminIds } }, select: PERSON_SELECT })
    : [];
  const adminById = new Map(admins.map((a) => [a.id, a]));

  return rows.map((row) => {
    const isAdmin = row.type === COMPANY_CREDIT_LEDGER_TYPE.GRANT_ADMIN;
    const signed = `${row.amount > 0 ? "+" : ""}${row.amount}`;
    let title = `Ajuste de créditos: ${signed}`;
    if (row.type === COMPANY_CREDIT_LEDGER_TYPE.GRANT_PLAN) title = `Créditos del plan: ${signed}`;
    if (row.type === COMPANY_CREDIT_LEDGER_TYPE.GRANT_PURCHASE) title = `Recarga: ${signed} créditos`;
    if (isAdmin) title = `Kadesh agregó ${row.amount} créditos`;
    return {
      id: `credits:${row.id}`,
      type: isAdmin ? "admin" : "credits",
      kind: isAdmin ? "admin.credits_granted" : `credits.${row.type.toLowerCase()}`,
      occurredAt: row.createdAt,
      title,
      detail: joinDetail([row.notes, row.balanceAfter != null ? `Saldo ${row.balanceAfter}` : null]),
      success: true,
      actor: isAdmin && row.referenceId ? adminById.get(row.referenceId) ?? null : null,
      company: row.company,
      entityType: "SaasCompanyCreditLedger",
      entityId: row.id,
      meta: { amount: row.amount, balanceAfter: row.balanceAfter, ledgerType: row.type },
    };
  });
}

async function aiSource(c: SourceCtx): Promise<FeedItem[]> {
  if (!c.types.has("ai")) return [];
  const where: Record<string, unknown> = { createdAt: timeFilter(c.before) };
  if (c.companyId) where.companyId = c.companyId;
  if (c.userId) where.userId = c.userId;
  if (c.onlyErrors) where.success = false;
  if (c.search) {
    where.OR = [
      { feature: insensitive(c.search) },
      { model: insensitive(c.search) },
      { errorMessage: insensitive(c.search) },
      { company: { name: insensitive(c.search) } },
      { user: personSearch(c.search) },
    ];
  }

  const rows: Array<{
    id: string;
    feature: string | null;
    provider: string | null;
    model: string | null;
    billingMode: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    creditsCharged: number | null;
    success: boolean;
    errorMessage: string | null;
    durationMs: number | null;
    createdAt: Date;
    user: Person | null;
    company: CompanyRef | null;
  }> = await c.prisma.techAiCallLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: c.take,
    // Sin featurePrompt/systemPrompt/userPrompt/response a propósito.
    select: {
      id: true,
      feature: true,
      provider: true,
      model: true,
      billingMode: true,
      inputTokens: true,
      outputTokens: true,
      creditsCharged: true,
      success: true,
      errorMessage: true,
      durationMs: true,
      createdAt: true,
      user: { select: PERSON_SELECT },
      company: COMPANY_SELECT,
    },
  });

  return rows.map((row) => ({
    id: `ai:${row.id}`,
    type: "ai",
    kind: "ai.call",
    occurredAt: row.createdAt,
    title: `IA: ${AI_FEATURE_LABELS[row.feature ?? ""] ?? row.feature ?? "llamada"}`,
    detail: row.success
      ? joinDetail([
          row.creditsCharged ? `${row.creditsCharged} créditos` : null,
          row.model,
        ])
      : joinDetail([row.errorMessage ?? "Falló la llamada", row.model]),
    success: row.success,
    actor: row.user,
    company: row.company,
    entityType: "TechAiCallLog",
    entityId: row.id,
    meta: {
      feature: row.feature,
      provider: row.provider,
      model: row.model,
      billingMode: row.billingMode,
      inputTokens: row.inputTokens ?? 0,
      outputTokens: row.outputTokens ?? 0,
      creditsCharged: row.creditsCharged ?? 0,
      durationMs: row.durationMs,
    },
  }));
}

async function billingSource(c: SourceCtx): Promise<FeedItem[]> {
  if (!c.types.has("billing")) return [];

  const logWhere: Record<string, unknown> = { createdAt: timeFilter(c.before) };
  if (c.companyId) logWhere.companyId = c.companyId;
  if (c.userId) logWhere.userId = c.userId;
  if (c.onlyErrors) logWhere.success = false;
  if (c.search) {
    logWhere.OR = [
      { message: insensitive(c.search) },
      { step: insensitive(c.search) },
      { emailMasked: insensitive(c.search) },
      { company: { name: insensitive(c.search) } },
    ];
  }

  const paymentWhere: Record<string, unknown> = {
    createdAt: timeFilter(c.before),
    status: c.onlyErrors ? "failed" : { notIn: ["succeeded"] },
  };
  const paymentAnd: Record<string, unknown>[] = [];
  if (c.companyId) {
    paymentAnd.push({
      OR: [{ subscription: { companyId: c.companyId } }, { user: { companyId: c.companyId } }],
    });
  }
  if (c.userId) paymentWhere.userId = c.userId;
  if (c.search) {
    paymentAnd.push({
      OR: [{ notes: insensitive(c.search) }, { stripeErrorMessage: insensitive(c.search) }],
    });
  }
  if (paymentAnd.length) paymentWhere.AND = paymentAnd;

  const [logs, payments] = await Promise.all([
    c.prisma.saasSubscriptionLog.findMany({
      where: logWhere,
      orderBy: { createdAt: "desc" },
      take: c.take,
      select: {
        id: true,
        step: true,
        success: true,
        message: true,
        totalSubmitted: true,
        createdAt: true,
        user: { select: PERSON_SELECT },
        company: COMPANY_SELECT,
        plan: { select: { name: true } },
      },
    }),
    c.prisma.saasPayment.findMany({
      where: paymentWhere,
      orderBy: { createdAt: "desc" },
      take: c.take,
      select: {
        id: true,
        amount: true,
        status: true,
        notes: true,
        stripeErrorMessage: true,
        createdAt: true,
        user: PERSON_WITH_COMPANY,
        subscription: { select: { company: COMPANY_SELECT } },
      },
    }),
  ]);

  const logItems: FeedItem[] = (
    logs as Array<{
      id: string;
      step: string;
      success: boolean;
      message: string;
      totalSubmitted: string;
      createdAt: Date;
      user: Person | null;
      company: CompanyRef | null;
      plan: { name: string } | null;
    }>
  ).map((row) => {
    let kind = "billing.checkout_failed";
    let title = "Pago no completado";
    if (row.step === SAAS_SUBSCRIPTION_LOG_STEP.SUCCESS) {
      kind = "billing.subscribed";
      title = row.plan?.name ? `Contrató el plan ${row.plan.name}` : "Contrató un plan";
    } else if (row.step === SAAS_SUBSCRIPTION_LOG_STEP.CREDIT_SUCCESS) {
      kind = "billing.credits_purchased";
      title = "Compró créditos";
    }
    const total = Number(row.totalSubmitted);
    return {
      id: `billing-log:${row.id}`,
      type: "billing",
      kind,
      occurredAt: row.createdAt,
      title,
      detail: row.success
        ? Number.isFinite(total) && total > 0
          ? money(total)
          : null
        : joinDetail([SUBSCRIPTION_STEP_LABELS[row.step] ?? row.step, row.message]),
      success: row.success,
      actor: row.user,
      company: row.company,
      entityType: "SaasSubscriptionLog",
      entityId: row.id,
      meta: { step: row.step, total: row.totalSubmitted || null },
    };
  });

  const paymentItems: FeedItem[] = (
    payments as Array<{
      id: string;
      amount: unknown;
      status: string | null;
      notes: string | null;
      stripeErrorMessage: string | null;
      createdAt: Date;
      user: (Person & { company: CompanyRef | null }) | null;
      subscription: { company: CompanyRef | null } | null;
    }>
  ).map((row) => {
    const amount = row.amount == null ? null : Number(row.amount);
    return {
      id: `payment:${row.id}`,
      type: "billing",
      kind: `billing.payment_${row.status ?? "unknown"}`,
      occurredAt: row.createdAt,
      title: PAYMENT_STATUS_TITLES[row.status ?? ""] ?? "Cobro",
      detail: joinDetail([money(amount), row.stripeErrorMessage ?? row.notes]),
      success: row.status !== "failed",
      actor: row.user,
      company: row.subscription?.company ?? row.user?.company ?? null,
      entityType: "SaasPayment",
      entityId: row.id,
      meta: { amount, status: row.status },
    };
  });

  return [...logItems, ...paymentItems];
}

async function whatsappSource(c: SourceCtx): Promise<FeedItem[]> {
  if (!c.types.has("whatsapp")) return [];
  // Solo salientes: es lo que hizo el equipo. Nunca se devuelve el cuerpo del mensaje.
  const where: Record<string, unknown> = {
    createdAt: timeFilter(c.before),
    direction: "outbound",
  };
  if (c.companyId) where.companyId = c.companyId;
  if (c.userId) where.sentById = c.userId;
  if (c.onlyErrors) where.status = "failed";
  if (c.search) {
    where.OR = [
      { toPhone: insensitive(c.search) },
      { senderLabel: insensitive(c.search) },
      { businessLead: { businessName: insensitive(c.search) } },
      { company: { name: insensitive(c.search) } },
    ];
  }

  const rows: Array<{
    id: string;
    status: string | null;
    toPhone: string | null;
    messageKind: string | null;
    mediaType: string | null;
    source: string | null;
    errorMessage: string | null;
    createdAt: Date;
    sentBy: Person | null;
    company: CompanyRef | null;
    businessLead: { id: string; businessName: string } | null;
    teamMember: { name: string; lastName: string } | null;
  }> = await c.prisma.techWhatsAppMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: c.take,
    select: {
      id: true,
      status: true,
      toPhone: true,
      messageKind: true,
      mediaType: true,
      source: true,
      errorMessage: true,
      createdAt: true,
      sentBy: { select: PERSON_SELECT },
      company: COMPANY_SELECT,
      businessLead: { select: { id: true, businessName: true } },
      teamMember: { select: { name: true, lastName: true } },
    },
  });

  return rows.map((row) => {
    const target =
      row.businessLead?.businessName ||
      [row.teamMember?.name, row.teamMember?.lastName].filter(Boolean).join(" ") ||
      row.toPhone ||
      "un contacto";
    const failed = row.status === "failed";
    return {
      id: `whatsapp:${row.id}`,
      type: "whatsapp",
      kind: failed ? "whatsapp.failed" : "whatsapp.sent",
      occurredAt: row.createdAt,
      title: failed ? `WhatsApp no enviado a ${target}` : `Envió WhatsApp a ${target}`,
      detail: joinDetail([
        row.messageKind === "template" ? "Plantilla" : null,
        row.mediaType ? "Con archivo" : null,
        row.source === "imported" ? "Importado" : null,
        failed ? row.errorMessage : null,
      ]),
      success: !failed,
      actor: row.sentBy,
      company: row.company,
      entityType: row.businessLead ? "TechBusinessLead" : "TechWhatsAppMessage",
      entityId: row.businessLead?.id ?? row.id,
      meta: { messageKind: row.messageKind, status: row.status },
    };
  });
}

async function crmSource(c: SourceCtx): Promise<FeedItem[]> {
  // El CRM no registra fallos.
  if (!c.types.has("crm") || c.onlyErrors) return [];

  const scope = c.companyId ? crmCompanyScope(c.companyId) : null;
  const byPerson = c.userId
    ? { OR: [{ createdById: c.userId }, { assignedSellerId: c.userId }] }
    : null;
  const leadSearch = c.search
    ? { businessLead: { businessName: insensitive(c.search) } }
    : null;

  const activityWhere = {
    AND: [
      { createdAt: timeFilter(c.before) },
      ...(scope ? [scope] : []),
      ...(byPerson ? [byPerson] : []),
      ...(c.search
        ? [{ OR: [{ title: insensitive(c.search) }, { type: insensitive(c.search) }, leadSearch] }]
        : []),
    ],
  };
  const proposalWhere = {
    AND: [
      { createdAt: timeFilter(c.before) },
      ...(scope ? [scope] : []),
      ...(byPerson ? [byPerson] : []),
      ...(c.search ? [{ OR: [{ product: insensitive(c.search) }, leadSearch] }] : []),
    ],
  };

  const quotationBase: Record<string, unknown>[] = [];
  if (c.companyId) quotationBase.push({ companyId: c.companyId });
  if (byPerson) quotationBase.push(byPerson);
  if (c.search) {
    quotationBase.push({
      OR: [
        { quotationNumber: insensitive(c.search) },
        { lead: { businessName: insensitive(c.search) } },
        { company: { name: insensitive(c.search) } },
      ],
    });
  }
  const quotationSelect = {
    id: true,
    quotationNumber: true,
    status: true,
    total: true,
    currency: true,
    createdAt: true,
    sentAt: true,
    acceptedAt: true,
    createdBy: { select: PERSON_SELECT },
    assignedSeller: { select: PERSON_SELECT },
    company: COMPANY_SELECT,
    lead: { select: { id: true, businessName: true } },
  };

  const [activities, proposals, quotationsCreated, quotationsSent, quotationsAccepted] =
    await Promise.all([
      c.prisma.techSalesActivity.findMany({
        where: activityWhere,
        orderBy: { createdAt: "desc" },
        take: c.take,
        select: {
          id: true,
          type: true,
          title: true,
          result: true,
          createdAt: true,
          createdBy: PERSON_WITH_COMPANY,
          assignedSeller: PERSON_WITH_COMPANY,
          businessLead: { select: { id: true, businessName: true } },
          workspace: { select: { company: COMPANY_SELECT } },
        },
      }),
      c.prisma.techProposal.findMany({
        where: proposalWhere,
        orderBy: { createdAt: "desc" },
        take: c.take,
        select: {
          id: true,
          status: true,
          amount: true,
          product: true,
          createdAt: true,
          createdBy: PERSON_WITH_COMPANY,
          assignedSeller: PERSON_WITH_COMPANY,
          businessLead: { select: { id: true, businessName: true } },
          workspace: { select: { company: COMPANY_SELECT } },
        },
      }),
      c.prisma.saasQuotation.findMany({
        where: { AND: [...quotationBase, { createdAt: timeFilter(c.before) }] },
        orderBy: { createdAt: "desc" },
        take: c.take,
        select: quotationSelect,
      }),
      c.prisma.saasQuotation.findMany({
        where: { AND: [...quotationBase, { sentAt: timeFilter(c.before) }] },
        orderBy: { sentAt: "desc" },
        take: c.take,
        select: quotationSelect,
      }),
      c.prisma.saasQuotation.findMany({
        where: { AND: [...quotationBase, { acceptedAt: timeFilter(c.before) }] },
        orderBy: { acceptedAt: "desc" },
        take: c.take,
        select: quotationSelect,
      }),
    ]);

  type CrmPerson = (Person & { company: CompanyRef | null }) | null;
  type LeadRef = { id: string; businessName: string } | null;

  const activityItems: FeedItem[] = (
    activities as Array<{
      id: string;
      type: string;
      title: string;
      result: string;
      createdAt: Date;
      createdBy: CrmPerson;
      assignedSeller: CrmPerson;
      businessLead: LeadRef;
      workspace: { company: CompanyRef | null } | null;
    }>
  ).map((row) => {
    const actor = row.createdBy ?? row.assignedSeller;
    return {
      id: `activity:${row.id}`,
      type: "crm",
      kind: "crm.activity_logged",
      occurredAt: row.createdAt,
      title: `Registró ${ACTIVITY_TYPE_LABELS[row.type] ?? "una actividad"} con ${row.businessLead?.businessName ?? "un lead"}`,
      detail: joinDetail([row.title || null, row.result || null]),
      success: true,
      actor,
      company: row.workspace?.company ?? actor?.company ?? null,
      entityType: row.businessLead ? "TechBusinessLead" : "TechSalesActivity",
      entityId: row.businessLead?.id ?? row.id,
      meta: { activityType: row.type, activityId: row.id },
    };
  });

  const proposalItems: FeedItem[] = (
    proposals as Array<{
      id: string;
      status: string | null;
      amount: number | null;
      product: string;
      createdAt: Date;
      createdBy: CrmPerson;
      assignedSeller: CrmPerson;
      businessLead: LeadRef;
      workspace: { company: CompanyRef | null } | null;
    }>
  ).map((row) => {
    const actor = row.createdBy ?? row.assignedSeller;
    return {
      id: `proposal:${row.id}`,
      type: "crm",
      kind: "crm.proposal_created",
      occurredAt: row.createdAt,
      title: `Registró una propuesta para ${row.businessLead?.businessName ?? "un lead"}`,
      detail: joinDetail([money(row.amount), row.status, row.product || null]),
      success: true,
      actor,
      company: row.workspace?.company ?? actor?.company ?? null,
      entityType: row.businessLead ? "TechBusinessLead" : "TechProposal",
      entityId: row.businessLead?.id ?? row.id,
      meta: { proposalId: row.id, status: row.status, amount: row.amount },
    };
  });

  type QuotationRow = {
    id: string;
    quotationNumber: string;
    status: string | null;
    total: number | null;
    currency: string;
    createdAt: Date | null;
    sentAt: Date | null;
    acceptedAt: Date | null;
    createdBy: Person | null;
    assignedSeller: Person | null;
    company: CompanyRef | null;
    lead: LeadRef;
  };
  const quotationItem = (
    row: QuotationRow,
    milestone: "created" | "sent" | "accepted",
    at: Date | null,
  ): FeedItem | null => {
    if (!at) return null;
    const label = row.quotationNumber ? `#${row.quotationNumber}` : "";
    const titles = {
      created: `Creó la cotización ${label}`.trim(),
      sent: `Envió la cotización ${label}`.trim(),
      accepted: `Aceptaron la cotización ${label}`.trim(),
    };
    return {
      id: `quotation:${row.id}:${milestone}`,
      type: "crm",
      kind: `crm.quotation_${milestone}`,
      occurredAt: at,
      title: titles[milestone],
      detail: joinDetail([row.lead?.businessName, money(row.total, row.currency)]),
      success: true,
      actor: row.createdBy ?? row.assignedSeller,
      company: row.company,
      entityType: "SaasQuotation",
      entityId: row.id,
      meta: { status: row.status, total: row.total, currency: row.currency },
    };
  };

  const quotationItems = [
    ...(quotationsCreated as QuotationRow[]).map((r) => quotationItem(r, "created", r.createdAt)),
    ...(quotationsSent as QuotationRow[]).map((r) => quotationItem(r, "sent", r.sentAt)),
    ...(quotationsAccepted as QuotationRow[]).map((r) => quotationItem(r, "accepted", r.acceptedAt)),
  ].filter((item): item is FeedItem => Boolean(item));

  return [...activityItems, ...proposalItems, ...quotationItems];
}

async function calendarSource(c: SourceCtx): Promise<FeedItem[]> {
  if (!c.types.has("calendar")) return [];
  // Solo fallos: los syncs correctos son ruido.
  const where: Record<string, unknown> = {
    createdAt: timeFilter(c.before),
    success: false,
  };
  const accountFilters: Record<string, unknown>[] = [];
  if (c.companyId) {
    accountFilters.push({
      OR: [{ companyId: c.companyId }, { user: { companyId: c.companyId } }],
    });
  }
  if (c.userId) {
    accountFilters.push({ OR: [{ userId: c.userId }, { connectedByUserId: c.userId }] });
  }
  if (accountFilters.length) where.account = { AND: accountFilters };
  if (c.search) {
    where.OR = [
      { errorMessage: insensitive(c.search) },
      { account: { googleAccountEmail: insensitive(c.search) } },
    ];
  }

  const rows: Array<{
    id: string;
    direction: string;
    operation: string;
    errorMessage: string | null;
    createdAt: Date;
    account: {
      googleAccountEmail: string;
      company: CompanyRef | null;
      user: (Person & { company: CompanyRef | null }) | null;
    } | null;
  }> = await c.prisma.techGoogleCalendarSyncLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: c.take,
    select: {
      id: true,
      direction: true,
      operation: true,
      errorMessage: true,
      createdAt: true,
      account: {
        select: {
          googleAccountEmail: true,
          company: COMPANY_SELECT,
          user: PERSON_WITH_COMPANY,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: `calendar:${row.id}`,
    type: "calendar",
    kind: "calendar.sync_failed",
    occurredAt: row.createdAt,
    title: `Calendario: falló ${CALENDAR_OPERATION_LABELS[row.operation] ?? row.operation}`,
    detail: joinDetail([row.account?.googleAccountEmail, row.errorMessage]),
    success: false,
    actor: row.account?.user ?? null,
    company: row.account?.company ?? row.account?.user?.company ?? null,
    entityType: "TechGoogleCalendarSyncLog",
    entityId: row.id,
    meta: { direction: row.direction, operation: row.operation },
  }));
}

const SOURCE_DETAIL: Record<string, string> = {
  [ACTIVITY_SOURCE.ADMIN]: "Admin de Kadesh",
  [ACTIVITY_SOURCE.WEBHOOK]: "Aviso de Stripe",
  [ACTIVITY_SOURCE.SYSTEM]: "Automático",
};

/**
 * Eventos propios (Fase 2): cambios hechos por personas, Stripe, navegación y registro del admin.
 * La categoría del evento es el tipo del feed. Antes de `yarn migrate` la tabla no existe y esta
 * fuente devuelve vacío, así que el feed sigue igual con los logs de siempre.
 */
async function activityEventSource(c: SourceCtx): Promise<FeedItem[]> {
  if (!c.prisma.activityEvent) return [];
  const categories = [...c.types];
  if (!categories.length) return [];

  const where: Record<string, unknown> = {
    createdAt: timeFilter(c.before),
    category: { in: categories },
    // Ya salen de su propia tabla (hitos de cotización, cobros de SaasPayment).
    type: { notIn: [...FEED_HIDDEN_EVENT_TYPES] },
  };
  const and: Record<string, unknown>[] = [];
  if (c.companyId) where.companyId = c.companyId;
  // Lo que hizo la persona y lo que le hicieron a su cuenta (roles, permisos).
  if (c.userId) and.push({ OR: [{ actorId: c.userId }, { entityType: "User", entityId: c.userId }] });
  if (c.onlyErrors) where.success = false;
  if (c.search) {
    and.push({
      OR: [
        { summary: insensitive(c.search) },
        { type: insensitive(c.search) },
        { company: { name: insensitive(c.search) } },
        { actor: personSearch(c.search) },
      ],
    });
  }
  if (and.length) where.AND = and;

  let rows: Array<{
    id: string;
    type: string;
    category: string;
    summary: string;
    metadata: Record<string, unknown> | null;
    source: string | null;
    success: boolean;
    errorMessage: string | null;
    entityType: string | null;
    entityId: string | null;
    createdAt: Date;
    actor: Person | null;
    company: CompanyRef | null;
  }>;
  try {
    rows = await c.prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: c.take,
      select: {
        id: true,
        type: true,
        category: true,
        summary: true,
        metadata: true,
        source: true,
        success: true,
        errorMessage: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actor: { select: PERSON_SELECT },
        company: COMPANY_SELECT,
      },
    });
  } catch {
    return [];
  }

  return rows.map((row) => ({
    id: `event:${row.id}`,
    type: (FEED_TYPES as readonly string[]).includes(row.category)
      ? (row.category as FeedType)
      : "product",
    kind: row.type,
    occurredAt: row.createdAt,
    title: row.summary || row.type,
    detail: joinDetail([
      row.source ? SOURCE_DETAIL[row.source] : null,
      row.success ? null : row.errorMessage,
    ]),
    success: row.success,
    actor: row.actor,
    company: row.company,
    entityType: row.entityType,
    entityId: row.entityId,
    meta: {
      ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
      source: row.source,
    },
  }));
}

const SOURCES = [
  authSource,
  extractionSource,
  creditsSource,
  aiSource,
  billingSource,
  whatsappSource,
  crmSource,
  calendarSource,
  activityEventSource,
];

const resolver = {
  adminActivityFeed: async (
    _root: unknown,
    { input }: { input?: Input | null },
    context: KeystoneContext,
  ) => {
    assertPlatformAdmin(context);
    const take = clampInt(input?.take, 1, 100, 30);
    const requested = (input?.types ?? []).filter((t): t is FeedType =>
      (FEED_TYPES as readonly string[]).includes(t),
    );
    const before = input?.before ? new Date(input.before) : null;

    const ctx: SourceCtx = {
      prisma: adminPrisma(context),
      companyId: input?.companyId?.trim() || null,
      userId: input?.userId?.trim() || null,
      onlyErrors: Boolean(input?.onlyErrors),
      search: input?.search?.trim() || null,
      before: before && !Number.isNaN(before.getTime()) ? before : null,
      // Uno de más por fuente para saber si hay otra página.
      take: take + 1,
      types: new Set(requested.length ? requested : DEFAULT_FEED_TYPES),
    };

    const batches = await Promise.all(SOURCES.map((source) => source(ctx)));
    const merged = batches
      .flat()
      .sort(
        (a, b) =>
          b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id),
      );
    const page = merged.slice(0, take);
    const hasMore = merged.length > take;

    return {
      items: page.map((item) => ({
        ...item,
        occurredAt: item.occurredAt.toISOString(),
        actor: personRef(item.actor),
      })),
      nextBefore: hasMore && page.length ? page[page.length - 1].occurredAt.toISOString() : null,
      hasMore,
    };
  },
};

export default { typeDefs, definition, resolver };
