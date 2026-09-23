import crypto from "crypto";

const GRAPH_API_VERSION =
  process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || "v21.0";

type WhatsAppGraphErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
  };
};

/**
 * Extrae un mensaje de error legible del body de la Graph API (o del texto crudo si no es JSON).
 *
 * Meta suele responder un `message` genérico ("Invalid parameter") y deja el motivo real en
 * `error_user_title` / `error_user_msg` / `error_subcode`. Sin esos campos el error no dice qué
 * corregir, así que se pliegan al `message`: todos los llamadores solo usan `message` y `code`,
 * y `code` (que se usa para detectar 131047) queda intacto.
 */
function parseGraphError(bodyText: string): { message: string; code?: number } {
  try {
    const parsed = JSON.parse(bodyText) as WhatsAppGraphErrorBody;
    const err = parsed?.error;
    if (err?.message) {
      const detail = [err.error_user_title, err.error_user_msg]
        .filter(Boolean)
        .join(": ");
      const subcode = err.error_subcode
        ? ` (subcódigo ${err.error_subcode})`
        : "";
      return {
        message: `${err.message}${detail ? ` — ${detail}` : ""}${subcode}`,
        code: err.code,
      };
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

  let parsed: { display_phone_number?: string; verified_name?: string } | null =
    null;
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
 * Crea una plantilla de mensaje (necesaria para iniciar una conversación con un lead que no ha
 * escrito antes — regla de Meta, no de Kadesh). Categoría MARKETING: es contacto de ventas, no
 * transaccional. Un solo componente BODY con 2 variables ({{1}} nombre del lead, {{2}} nombre
 * de la empresa). Meta la deja en PENDING hasta que la revisa (minutos a un par de días).
 *
 * `bodyExamples` es obligatorio si el texto lleva variables: Meta rechaza la creación con
 * `{{1}}` sin un valor de ejemplo por variable (en el mismo orden).
 */
export async function createWhatsAppTemplate({
  wabaId,
  accessToken,
  name,
  language,
  bodyText,
  bodyExamples,
}: {
  wabaId: string;
  accessToken: string;
  name: string;
  language: string;
  bodyText: string;
  bodyExamples: string[];
}): Promise<{ id: string; status: string }> {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        language,
        category: "MARKETING",
        components: [
          {
            type: "BODY",
            text: bodyText,
            ...(bodyExamples.length > 0
              ? { example: { body_text: [bodyExamples] } }
              : {}),
          },
        ],
      }),
    },
  );

  const bodyTextRes = await response.text();

  if (!response.ok) {
    const { message } = parseGraphError(bodyTextRes);
    throw new Error(`[whatsapp] Graph API error creando plantilla: ${message}`);
  }

  let parsed: { id?: string; status?: string } | null = null;
  try {
    parsed = JSON.parse(bodyTextRes);
  } catch {
    parsed = null;
  }

  if (!parsed?.id) {
    throw new Error("[whatsapp] La API no regresó un id de plantilla");
  }

  return { id: parsed.id, status: parsed.status || "PENDING" };
}

/** Manda una plantilla ya aprobada — único tipo de mensaje permitido para iniciar conversación. */
export async function sendWhatsAppTemplateMessage({
  phoneNumberId,
  accessToken,
  to,
  templateName,
  language,
  bodyParams,
}: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  language: string;
  bodyParams: string[];
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
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          components: [
            {
              type: "body",
              parameters: bodyParams.map((text) => ({ type: "text", text })),
            },
          ],
        },
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

/** Sube un archivo a la Media API de Meta; regresa el media id para referenciarlo al mandar. */
export async function uploadMediaToWhatsApp({
  phoneNumberId,
  accessToken,
  buffer,
  mimetype,
  filename,
}: {
  phoneNumberId: string;
  accessToken: string;
  buffer: Buffer;
  mimetype: string;
  filename: string;
}): Promise<{ id: string }> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimetype }),
    filename,
  );

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  );

  const bodyText = await response.text();

  if (!response.ok) {
    const { message } = parseGraphError(bodyText);
    throw new Error(`[whatsapp] Graph API error subiendo media: ${message}`);
  }

  let parsed: { id?: string } | null = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = null;
  }

  if (!parsed?.id) {
    throw new Error("[whatsapp] La API no regresó un id de media");
  }

  return { id: parsed.id };
}

/** Manda un mensaje de imagen o documento ya subido a la Media API (ver `uploadMediaToWhatsApp`). */
export async function sendWhatsAppMediaMessage({
  phoneNumberId,
  accessToken,
  to,
  mediaId,
  type,
  filename,
  caption,
}: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  mediaId: string;
  type: "image" | "document";
  filename?: string;
  caption?: string;
}): Promise<{ id: string }> {
  const mediaPayload: Record<string, unknown> = { id: mediaId };
  if (caption) mediaPayload.caption = caption;
  if (type === "document" && filename) mediaPayload.filename = filename;

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
        type,
        [type]: mediaPayload,
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

/** Metadata de un media entrante (Meta solo manda el `id` en el webhook, no la URL/bytes). */
export async function fetchWhatsAppMediaUrl({
  mediaId,
  accessToken,
}: {
  mediaId: string;
  accessToken: string;
}): Promise<{ url: string; mimeType: string }> {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const bodyText = await response.text();

  if (!response.ok) {
    const { message } = parseGraphError(bodyText);
    throw new Error(`[whatsapp] Graph API error consultando media: ${message}`);
  }

  let parsed: { url?: string; mime_type?: string } | null = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = null;
  }

  if (!parsed?.url) {
    throw new Error("[whatsapp] La API no regresó una URL de media");
  }

  return {
    url: parsed.url,
    mimeType: parsed.mime_type || "application/octet-stream",
  };
}

/** Descarga el binario de una URL temporal de media de Meta (requiere el mismo token, expira). */
export async function downloadWhatsAppMedia({
  url,
  accessToken,
}: {
  url: string;
  accessToken: string;
}): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(
      `[whatsapp] No se pudo descargar el media (HTTP ${response.status})`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  const received = signatureHeader.replace(/^sha256=/, "");

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(received, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
