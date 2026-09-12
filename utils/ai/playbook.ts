import { KeystoneContext } from "@keystone-6/core/types";
import { AI_INSIGHT_KIND } from "../../models/Tech/AiInsight/constants";
import {
  formatActionsAsContent,
  parseDigestActions,
  toDigestInsightPayload,
  type DigestAction,
  type DigestInsightRecord,
} from "./dailyDigest";

export const PLAYBOOK_REFERENCE_KEY = "playbook";

const INSIGHT_QUERY =
  "id referenceKey content structuredData generatedAt salesPerson { id }";

export const PROFILE_PLAYBOOK_FEATURE_PROMPT = `Vas a proponer exactamente 4 recomendaciones de venta para ESTA empresa, no un resumen del pipeline.
Responde SOLO con JSON válido, sin markdown, con esta forma:
{"actions":[{"title":"...","detail":"..."}]}
Cada title máximo 80 caracteres. Cada detail 1 o 2 frases concretas, ancladas a lo que venden, a quién se lo venden y cómo consiguen clientes.
Prioriza: 1) cómo hablarle al cliente ideal, 2) dónde prospectar en su industria, 3) cómo calificar por ticket, 4) cómo atajar el dolor de adquisición que ya describieron.
No inventes datos que no estén en el contexto. Si falta información de perfil, una de las recomendaciones debe pedir completar ese hueco.
Tono de consultor comercial claro y accionable.`;

export function playbookUserPrompt(company: {
  name?: string | null;
  onboardingMainOffer?: string | null;
  onboardingIdealCustomer?: string | null;
  onboardingAvgTicketValue?: string | null;
  onboardingSalesPain?: string | null;
  allowedGooglePlaceCategories?: unknown;
}): string {
  const categories = Array.isArray(company.allowedGooglePlaceCategories)
    ? company.allowedGooglePlaceCategories.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
  const line = (label: string, value?: string | null) =>
    `- ${label}: ${value?.trim() || "(sin definir)"}`;
  return [
    "Construye recomendaciones con este perfil de negocio:",
    line("Empresa", company.name),
    line("Qué vende", company.onboardingMainOffer),
    line("Cliente ideal", company.onboardingIdealCustomer),
    line("Ticket / valor", company.onboardingAvgTicketValue),
    line("Cómo consigue clientes / dolor", company.onboardingSalesPain),
    categories.length
      ? `- Nichos de extracción: ${categories.join(", ")}`
      : "- Nichos de extracción: (sin definir)",
  ].join("\n");
}

export function fallbackPlaybookActions(prompt: string): DigestAction[] {
  const missing = prompt.includes("(sin definir)");
  return [
    {
      title: "Aclara a quién le vendes",
      detail:
        "Define el cliente ideal en el perfil para que la IA priorice leads que sí cierran, no solo los que aparecen en el mapa.",
    },
    {
      title: "Prospecta en tu industria, no en general",
      detail:
        "Usa categorías de extracción alineadas a lo que vendes. Un nicho estrecho rinde más llamadas que un radio amplio.",
    },
    {
      title: "Califica por ticket desde el primer contacto",
      detail:
        "Si ya tienes un ticket o valor, úsalo para filtrar. No gastes seguimiento en quien no puede pagar tu oferta.",
    },
    {
      title: missing
        ? "Completa el contexto de tu negocio"
        : "Convierte tu dolor de adquisición en un proceso",
      detail: missing
        ? "Oferta, cliente ideal, ticket y cómo consigues clientes alimentan cada recomendación. Sin eso, la IA improvisa."
        : "Documenta el siguiente paso repetible (WhatsApp, llamada, demo) para no depender de la inspiración de cada vendedor.",
    },
  ];
}

export async function findProfilePlaybook(
  context: KeystoneContext,
  companyId: string,
): Promise<DigestInsightRecord | null> {
  const rows = (await context.sudo().query.TechAiInsight.findMany({
    where: {
      company: { id: { equals: companyId } },
      kind: { equals: AI_INSIGHT_KIND.PROFILE_PLAYBOOK },
      referenceKey: { equals: PLAYBOOK_REFERENCE_KEY },
    },
    take: 5,
    orderBy: [{ generatedAt: "desc" }],
    query: INSIGHT_QUERY,
  })) as Array<DigestInsightRecord & { salesPerson?: { id: string } | null }>;
  return rows.find((row) => !row.salesPerson) ?? null;
}

export async function saveProfilePlaybook(
  context: KeystoneContext,
  params: {
    companyId: string;
    actions: DigestAction[];
    existingId?: string;
  },
): Promise<DigestInsightRecord> {
  const data: Record<string, unknown> = {
    kind: AI_INSIGHT_KIND.PROFILE_PLAYBOOK,
    referenceKey: PLAYBOOK_REFERENCE_KEY,
    content: formatActionsAsContent(params.actions),
    structuredData: { actions: params.actions },
    generatedAt: new Date().toISOString(),
    company: { connect: { id: params.companyId } },
  };

  if (params.existingId) {
    return (await context.sudo().query.TechAiInsight.updateOne({
      where: { id: params.existingId },
      data,
      query: INSIGHT_QUERY,
    })) as DigestInsightRecord;
  }

  return (await context.sudo().query.TechAiInsight.createOne({
    data,
    query: INSIGHT_QUERY,
  })) as DigestInsightRecord;
}

export { parseDigestActions, toDigestInsightPayload };
