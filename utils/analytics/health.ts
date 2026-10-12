import { SUBSCRIPTION_STATUS } from "../../models/Saas/SaasCompanySubscription/constants";

/**
 * Salud de una empresa (0–100) a partir de las últimas 4 semanas de uso.
 *
 * | Parte | Máx. | Qué mide |
 * |---|---|---|
 * | Constancia | 30 | Días con el panel abierto (meta: 16 de 28, casi todos los días hábiles) |
 * | Equipo | 15 | Qué parte del equipo entra |
 * | Uso | 25 | Extracciones, movimientos del CRM, actividades, cotizaciones, WhatsApp |
 * | Tiempo | 15 | Minutos con el panel abierto por persona (meta: 2 h en 4 semanas) |
 * | Pago | 15 | Plan activo (en prueba vale 10; con pago vencido o sin plan, 0) |
 *
 * Las metas se ajustan a la antigüedad: una empresa de 5 días no puede tener 16 días activos.
 * Si casi todo su uso fue hace más de 2 semanas, Constancia, Uso y Tiempo valen menos (hasta la
 * mitad): una empresa que dejó de entrar no debe salir "sana" por lo que hizo antes.
 * Es una regla simple y explicable a propósito (no un modelo): sirve para ordenar a quién atender.
 */

export const HEALTH_WINDOW_DAYS = 28;

const ACTIVE_DAYS_TARGET = 16;
const USAGE_POINTS_TARGET = 60;
const MINUTES_PER_PERSON_TARGET = 120;
const NEW_COMPANY_DAYS = 21;
/** Días de gracia antes de marcar "nadie ha entrado": recién registrada todavía no cuenta. */
const NEVER_USED_GRACE_DAYS = 3;
const EARLY_EXHAUSTION_DAY = 20;

export type HealthLabel = "healthy" | "watch" | "risk";
export type HealthTrend = "up" | "down" | "stable" | "new" | "inactive";

export type HealthInput = {
  /** Días desde el alta de la empresa. */
  ageDays: number;
  teamSize: number;
  activeUsers: number;
  activeDays: number;
  minutes: number;
  extractions: number;
  extractionsFailed: number;
  crmChanges: number;
  activities: number;
  quotations: number;
  whatsappSent: number;
  /** Actividad (minutos + acciones) de las últimas 2 semanas y de las 2 anteriores. */
  recentActivity: number;
  previousActivity: number;
  status: string | null;
  /** Día del mes (CDMX) en que se quedó sin créditos este mes, si pasó. */
  creditsExhaustedDay: number | null;
  /** Veces que vio módulos bloqueados o hizo clic en mejorar plan. */
  purchaseIntent: number;
  paymentFailures: number;
  /** Días desde la última vez que alguien entró (null = nunca). */
  daysSinceSeen: number | null;
};

export type HealthFlagKey = "churn_risk" | "upsell";

/** Motivo concreto de la alerta: lo usa Inicio para no repetir avisos que ya tiene (pago vencido, inactiva, sin créditos). */
export type HealthFlagReason =
  | "payment_overdue"
  | "never_used"
  | "inactive"
  | "usage_drop"
  | "low_health"
  | "credits_exhausted"
  | "purchase_intent"
  | "trial_ready";

export type HealthFlag = { key: HealthFlagKey; reason: HealthFlagReason; label: string };

export type HealthResult = {
  score: number;
  label: HealthLabel;
  trend: HealthTrend;
  /** Cambio de actividad de las últimas 2 semanas contra las 2 anteriores (%). */
  changePct: number | null;
  components: { activity: number; adoption: number; usage: number; engagement: number; billing: number };
  flags: HealthFlag[];
};

function ratio(value: number, target: number): number {
  return target <= 0 ? 0 : Math.min(1, Math.max(0, value / target));
}

function billingPoints(status: string | null, paymentFailures: number): number {
  let points = 0;
  if (status === SUBSCRIPTION_STATUS.ACTIVE) points = 15;
  else if (status === SUBSCRIPTION_STATUS.TRIALING) points = 10;
  if (paymentFailures > 0) points = Math.max(0, points - 5);
  return points;
}

/** Actividad comparable entre periodos: minutos + 10 por cada acción del negocio. */
export function activityPoints(row: {
  minutes: number;
  extractions: number;
  crmChanges: number;
  activities: number;
  quotations: number;
}): number {
  return row.minutes + 10 * (row.extractions + row.crmChanges + row.activities + row.quotations);
}

export function scoreHealth(input: HealthInput): HealthResult {
  // Metas proporcionales a los días que lleva la empresa (máx. 28).
  const window = Math.max(1, Math.min(HEALTH_WINDOW_DAYS, input.ageDays));
  const scale = window / HEALTH_WINDOW_DAYS;
  const activeDaysTarget = Math.max(3, Math.round(ACTIVE_DAYS_TARGET * scale));
  const usageTarget = Math.max(10, USAGE_POINTS_TARGET * scale);
  const minutesTarget = Math.max(20, MINUTES_PER_PERSON_TARGET * scale);

  // Las extracciones fallidas no cuentan como uso (ya restan aparte si son muchas).
  const usagePoints =
    Math.max(0, input.extractions - input.extractionsFailed) * 3 +
    input.crmChanges +
    input.activities * 2 +
    input.quotations * 4 +
    input.whatsappSent * 0.5;

  // Peso de lo reciente: 1 si las últimas 2 semanas tienen al menos la mitad del uso; baja hasta
  // 0.5 si todo fue en las 2 anteriores.
  const recentAndPrevious = input.recentActivity + input.previousActivity;
  const recency =
    recentAndPrevious > 0 ? Math.min(1, 0.5 + input.recentActivity / recentAndPrevious) : 1;

  const components = {
    activity: Math.round(ratio(input.activeDays, activeDaysTarget) * 30 * recency),
    adoption: Math.round(input.teamSize ? ratio(input.activeUsers, input.teamSize) * 15 : 0),
    usage: Math.round(ratio(usagePoints, usageTarget) * 25 * recency),
    engagement: Math.round(
      (input.teamSize ? ratio(input.minutes / input.teamSize, minutesTarget) : 0) * 15 * recency,
    ),
    billing: billingPoints(input.status, input.paymentFailures),
  };
  const failingExtractions =
    input.extractions >= 3 && input.extractionsFailed / input.extractions > 0.3 ? 5 : 0;
  const raw =
    components.activity +
    components.adoption +
    components.usage +
    components.engagement +
    components.billing -
    failingExtractions;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const label: HealthLabel = score >= 70 ? "healthy" : score >= 40 ? "watch" : "risk";

  let trend: HealthTrend;
  let changePct: number | null = null;
  if (input.ageDays < NEW_COMPANY_DAYS) {
    trend = "new";
  } else if (input.recentActivity === 0 && input.previousActivity === 0) {
    trend = "inactive";
  } else if (input.previousActivity === 0) {
    trend = "up";
  } else {
    const change = (input.recentActivity - input.previousActivity) / input.previousActivity;
    changePct = Math.round(change * 100);
    trend = change > 0.2 ? "up" : change < -0.2 ? "down" : "stable";
  }

  const flags: HealthFlag[] = [];
  const hasPlan =
    input.status === SUBSCRIPTION_STATUS.ACTIVE || input.status === SUBSCRIPTION_STATUS.TRIALING;
  const paymentProblem =
    input.status === SUBSCRIPTION_STATUS.PAST_DUE || input.status === SUBSCRIPTION_STATUS.UNPAID;

  // Riesgo de baja: el motivo más fuerte primero.
  if (paymentProblem) {
    flags.push({ key: "churn_risk", reason: "payment_overdue", label: "Pago vencido" });
  } else if (hasPlan) {
    if (input.daysSinceSeen == null && input.ageDays >= NEVER_USED_GRACE_DAYS) {
      flags.push({ key: "churn_risk", reason: "never_used", label: "Nadie del equipo ha entrado" });
    } else if (input.daysSinceSeen != null && input.daysSinceSeen >= 14) {
      flags.push({
        key: "churn_risk",
        reason: "inactive",
        label: `Nadie entra hace ${input.daysSinceSeen} días`,
      });
    } else if (trend === "down" && changePct != null && changePct <= -40) {
      flags.push({
        key: "churn_risk",
        reason: "usage_drop",
        label: `El uso cayó ${Math.abs(changePct)}% en 2 semanas`,
      });
    } else if (label === "risk" && input.ageDays >= NEW_COMPANY_DAYS) {
      flags.push({ key: "churn_risk", reason: "low_health", label: `Salud baja (${score})` });
    }
  }

  // Oportunidad de venta.
  if (input.creditsExhaustedDay != null && input.creditsExhaustedDay <= EARLY_EXHAUSTION_DAY) {
    flags.push({
      key: "upsell",
      reason: "credits_exhausted",
      label: `Se quedó sin créditos el día ${input.creditsExhaustedDay}`,
    });
  } else if (input.purchaseIntent >= 2) {
    flags.push({
      key: "upsell",
      reason: "purchase_intent",
      label: `Vio módulos de otro plan o pidió mejorar (${input.purchaseIntent} veces)`,
    });
  } else if (input.status === SUBSCRIPTION_STATUS.TRIALING && score >= 60) {
    flags.push({ key: "upsell", reason: "trial_ready", label: "Prueba con buen uso: lista para pagar" });
  }

  return { score, label, trend, changePct, components, flags };
}
