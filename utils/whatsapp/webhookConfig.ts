/**
 * Callback URL + Verify Token del webhook único de Kadesh (un solo endpoint atiende a todas las
 * empresas). Tolera que `WHATSAPP_WEBHOOK_BASE_URL` traiga la URL completa con
 * `/webhooks/whatsapp` en vez de solo el dominio.
 */
export function getWebhookConfig(): { webhookUrl: string; verifyToken: string } | null {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  const baseUrl = process.env.WHATSAPP_WEBHOOK_BASE_URL?.trim()
    .replace(/\/+$/, "")
    .replace(/\/webhooks\/whatsapp$/, "");

  if (!verifyToken || !baseUrl) return null;
  return { webhookUrl: `${baseUrl}/webhooks/whatsapp`, verifyToken };
}
