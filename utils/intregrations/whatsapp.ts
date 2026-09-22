import crypto from "crypto";

const GRAPH_API_VERSION =
  process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || "v21.0";

type WhatsAppGraphErrorBody = {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
};

/** Extrae un mensaje de error legible del body de la Graph API (o del texto crudo si no es JSON). */
function parseGraphError(bodyText: string): { message: string; code?: number } {
  try {
    const parsed = JSON.parse(bodyText) as WhatsAppGraphErrorBody;
    if (parsed?.error?.message) {
      return { message: parsed.error.message, code: parsed.error.code };
    }
  } catch {
    // no era JSON
  }
  return { message: bodyText || "Error desconocido de la Graph API" };
}

/**
 * Manda un mensaje de texto libre por WhatsApp Cloud API. Solo funciona dentro de la ventana
 * de 24h desde el último mensaje del lead (fuera de eso, Meta rechaza con error code 131047 —
 * se necesitaría una plantilla aprobada, no soportado todavía).
 */
export async function sendWhatsAppTextMessage({
  phoneNumberId,
  accessToken,
  to,
  body,
}: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}): Promise<{ id: string }> {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    },
  );

  const bodyText = await response.text();

  if (!response.ok) {
    const { message, code } = parseGraphError(bodyText);
    const err = new Error(`[whatsapp] Graph API error: ${message}`) as Error & {
      graphCode?: number;
    };
    err.graphCode = code;
    throw err;
  }

  let parsed: { messages?: { id?: string }[] } | null = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = null;
  }

  const id = parsed?.messages?.[0]?.id;
  if (!id) {
    throw new Error("[whatsapp] La API no regresó un id de mensaje");
  }

  return { id };
}

/** Datos del número conectado (para "probar conexión": confirma que el token/id son válidos). */
export async function fetchWhatsAppPhoneNumberInfo({
  phoneNumberId,
  accessToken,
}: {
  phoneNumberId: string;
  accessToken: string;
}): Promise<{ displayPhoneNumber: string; verifiedName: string }> {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const bodyText = await response.text();

  if (!response.ok) {
    const { message } = parseGraphError(bodyText);
    throw new Error(`[whatsapp] Graph API error: ${message}`);
  }

  let parsed: { display_phone_number?: string; verified_name?: string } | null = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = null;
  }

  return {
    displayPhoneNumber: parsed?.display_phone_number || "",
    verifiedName: parsed?.verified_name || "",
  };
}

/**
 * Verifica la firma `X-Hub-Signature-256` de un webhook de Meta contra el body crudo, usando
 * el App Secret de la App de Meta dueña del número. Comparación en tiempo constante.
 */
export function verifyWhatsAppSignature({
  appSecret,
  rawBody,
  signatureHeader,
}: {
  appSecret: string;
  rawBody: Buffer;
  signatureHeader: string | undefined;
}): boolean {
  if (!signatureHeader) return false;

  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signatureHeader.replace(/^sha256=/, "");

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(received, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
