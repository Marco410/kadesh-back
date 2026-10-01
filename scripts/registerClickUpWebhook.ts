/**
 * Registra UNA vez el webhook de ClickUp a nivel workspace (sin list_id:
 * Pet y Negocios están en espacios distintos y comparten un solo secret).
 *
 *   pnpm clickup:register-webhook
 *
 * Necesita CLICKUP_API_TOKEN y WHATSAPP_WEBHOOK_BASE_URL (config/.env.dev o el entorno).
 * Imprime el id y el secret: el secret va en CLICKUP_WEBHOOK_SECRET en Railway.
 */
import "../env";

const CLICKUP_TEAM_ID = "9017505640";

function webhookEndpoint(): string {
  const baseUrl = process.env.WHATSAPP_WEBHOOK_BASE_URL?.trim()
    .replace(/\/+$/, "")
    .replace(/\/webhooks\/whatsapp$/, "");
  if (!baseUrl) {
    throw new Error("Falta WHATSAPP_WEBHOOK_BASE_URL");
  }
  return `${baseUrl}/webhooks/clickup`;
}

async function main() {
  const token = process.env.CLICKUP_API_TOKEN?.trim();
  if (!token) throw new Error("Falta CLICKUP_API_TOKEN");

  const endpoint = webhookEndpoint();
  const response = await fetch(
    `https://api.clickup.com/api/v2/team/${CLICKUP_TEAM_ID}/webhook`,
    {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        endpoint,
        events: ["taskStatusUpdated"],
      }),
    },
  );

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`ClickUp respondió ${response.status}: ${bodyText || "sin detalle"}`);
  }

  const parsed = bodyText ? (JSON.parse(bodyText) as { id?: string; webhook?: { id?: string; secret?: string }; secret?: string }) : {};
  const webhook = parsed.webhook ?? parsed;
  console.log("Webhook registrado.");
  console.log("endpoint:", endpoint);
  console.log("id:", webhook.id ?? "(no vino en la respuesta)");
  console.log("secret:", webhook.secret ?? "(no vino en la respuesta)");
  console.log("Copia el secret a CLICKUP_WEBHOOK_SECRET en Railway.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
