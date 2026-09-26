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
function parseGraphError(bodyText: string): {
  message: string;
  code?: number;
  subcode?: number;
} {
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
        subcode: err.error_subcode,
      };
    }
  } catch {
    // no era JSON
  }
  return { message: bodyText || "Error desconocido de la Graph API" };
}

/** Error de la Graph API con código y subcódigo como datos (no solo pegados en el texto). */
export type GraphApiError = Error & { graphCode?: number; graphSubcode?: number };

function graphError(prefix: string, bodyText: string): GraphApiError {
  const { message, code, subcode } = parseGraphError(bodyText);
  const err = new Error(`${prefix} ${message}`) as GraphApiError;
  err.graphCode = code;
  err.graphSubcode = subcode;
  return err;
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
    throw graphError("[whatsapp] Graph API error:", bodyText);
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
    throw graphError("[whatsapp] Graph API error:", bodyText);
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
 * Qué cuenta de WhatsApp Business es ese ID y qué números contiene. Sirve para comprobar que el
 * "WhatsApp Business Account ID" que pegó la empresa es de verdad el de la cuenta dueña del
 * número (el error más común de BYOK: copiar otro ID), y para poder nombrar la cuenta en los
 * errores en vez de solo repetir el mensaje genérico de Meta.
 */
export async function fetchWhatsAppBusinessAccountInfo({
  wabaId,
  accessToken,
}: {
  wabaId: string;
  accessToken: string;
}): Promise<{ id: string; name: string; phoneNumberIds: string[] }> {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}?fields=id,name,phone_numbers.limit(100){id}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const bodyText = await response.text();

  if (!response.ok) {
    throw graphError("[whatsapp] Graph API error:", bodyText);
  }

  let parsed: {
    id?: string;
    name?: string;
    phone_numbers?: { data?: Array<{ id?: string }> };
  } | null = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = null;
  }

  return {
    id: parsed?.id || wabaId,
    name: parsed?.name || "",
    phoneNumberIds: (parsed?.phone_numbers?.data ?? [])
      .map((n) => n.id)
      .filter((id): id is string => Boolean(id)),
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
    throw graphError("[whatsapp] Graph API error creando plantilla:", bodyTextRes);
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

export type WhatsAppTemplateSummary = {
  name: string;
  language: string;
  status: string;
  category: string;
  /** Sólo si el encabezado es de texto; los de imagen/documento no se soportan al iniciar. */
  headerText: string | null;
  bodyText: string;
  footerText: string | null;
  /** Cuántas `{{n}}` hay que rellenar en el cuerpo. */
  variableCount: number;
};

type GraphTemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
};

/** `{{1}} … {{3}}` → 3. Meta numera desde 1 y exige un parámetro por variable, en orden. */
export function countTemplateVariables(bodyText: string): number {
  let max = 0;
  for (const m of bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    max = Math.max(max, Number(m[1]) || 0);
  }
  return max;
}

function toTemplateSummary(raw: {
  name?: string;
  language?: string;
  status?: string;
  category?: string;
  components?: GraphTemplateComponent[];
}): WhatsAppTemplateSummary | null {
  if (!raw.name) return null;

  const components = raw.components ?? [];
  const body = components.find((c) => c.type?.toUpperCase() === "BODY");
  const header = components.find((c) => c.type?.toUpperCase() === "HEADER");
  const footer = components.find((c) => c.type?.toUpperCase() === "FOOTER");
  const bodyText = body?.text || "";

  return {
    name: raw.name,
    language: raw.language || "",
    status: (raw.status || "PENDING").toUpperCase(),
    category: (raw.category || "").toUpperCase(),
    headerText: header?.format?.toUpperCase() === "TEXT" ? header.text || null : null,
    bodyText,
    footerText: footer?.text || null,
    variableCount: countTemplateVariables(bodyText),
  };
}

/**
 * Lista las plantillas de una cuenta de WhatsApp Business, con su cuerpo y cuántas variables
 * pide cada una — es lo que permite ofrecerle al usuario un selector en vez de una sola
 * plantilla fija. `name` filtra del lado de Meta, pero por coincidencia parcial: quien necesite
 * una plantilla concreta debe comparar el nombre exacto.
 */
export async function listWhatsAppTemplates({
  wabaId,
  accessToken,
  name,
}: {
  wabaId: string;
  accessToken: string;
  name?: string;
}): Promise<WhatsAppTemplateSummary[]> {
  const params = new URLSearchParams({
    fields: "name,language,status,category,components",
    limit: "200",
  });
  if (name) params.set("name", name);

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const bodyText = await response.text();

  if (!response.ok) {
    throw graphError("[whatsapp] Graph API error consultando plantillas:", bodyText);
  }

  let parsed: { data?: Array<Parameters<typeof toTemplateSummary>[0]> } | null = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = null;
  }

  return (parsed?.data ?? [])
    .map(toTemplateSummary)
    .filter((t): t is WhatsAppTemplateSummary => t !== null);
}

/**
 * Consulta el estado real de una plantilla en Meta (APPROVED / PENDING / REJECTED / …).
 *
 * Existe porque el webhook `message_template_status_update` es la única otra fuente del estado, y
 * si la empresa no lo configuró (o el evento se perdió) la plantilla se queda marcada como
 * pendiente para siempre aunque Meta ya la haya aprobado.
 *
 * Devuelve `null` si esa plantilla no existe en la cuenta — no es un error: significa que hay que
 * crearla.
 */
export async function fetchWhatsAppTemplateStatus({
  wabaId,
  accessToken,
  name,
  language,
}: {
  wabaId: string;
  accessToken: string;
  name: string;
  language?: string | null;
}): Promise<{ status: string; language: string } | null> {
  const templates = await listWhatsAppTemplates({ wabaId, accessToken, name });

  // El filtro `name` de Meta es por coincidencia parcial, así que puede regresar otras plantillas
  // (y una por idioma): hay que quedarse con la del nombre exacto, prefiriendo el idioma guardado.
  const matches = templates.filter((t) => t.name === name);
  if (matches.length === 0) return null;

  const match = (language && matches.find((t) => t.language === language)) || matches[0];

  return { status: match.status, language: match.language || language || "" };
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
          // Una plantilla sin variables tiene que ir SIN `components`: Meta rechaza un
          // `parameters: []` con "number of parameters does not match".
          ...(bodyParams.length > 0
            ? {
                components: [
                  {
                    type: "body",
                    parameters: bodyParams.map((text) => ({ type: "text", text })),
                  },
                ],
              }
            : {}),
        },
      }),
    },
  );

  const bodyText = await response.text();

  if (!response.ok) {
    throw graphError("[whatsapp] Graph API error:", bodyText);
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
    throw graphError("[whatsapp] Graph API error subiendo media:", bodyText);
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
    throw graphError("[whatsapp] Graph API error:", bodyText);
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
    throw graphError("[whatsapp] Graph API error consultando media:", bodyText);
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

export type WhatsAppTokenInfo = {
  isValid: boolean;
  /** App dueña del token (debe coincidir con el App ID que pegó la empresa). */
  appId: string | null;
  /** 0 = no expira. */
  expiresAt: number;
  scopes: string[];
  /** WABA IDs a los que el token da acceso (granular_scopes de whatsapp_business_management). */
  wabaIds: string[];
  /** Motivo de invalidez que Meta reporta dentro de `data.error`, si lo hay. */
  invalidReason: string | null;
};

/**
 * Inspecciona un token con `GET /debug_token`, autenticado con el token de la App
 * (`appId|appSecret`). Es lo que permite decir "el token es de otra App", "expiró" o "le falta
 * el permiso X" en vez de un error genérico, y descubrir los WABA IDs sin pedírselos al usuario.
 * (No verificado con una llamada real todavía: probar antes de darlo por bueno.)
 */
export async function debugWhatsAppToken({
  appId,
  appSecret,
  accessToken,
}: {
  appId: string;
  appSecret: string;
  accessToken: string;
}): Promise<WhatsAppTokenInfo> {
  const params = new URLSearchParams({
    input_token: accessToken,
    access_token: `${appId}|${appSecret}`,
  });
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/debug_token?${params.toString()}`,
  );

  const bodyText = await response.text();

  if (!response.ok) {
    throw graphError("[whatsapp] Graph API error:", bodyText);
  }

  let parsed: {
    data?: {
      app_id?: string;
      is_valid?: boolean;
      expires_at?: number;
      scopes?: string[];
      granular_scopes?: Array<{ scope?: string; target_ids?: string[] }>;
      error?: { message?: string };
    };
  } | null = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = null;
  }

  const data = parsed?.data;
  const wabaIds = new Set<string>();
  for (const g of data?.granular_scopes ?? []) {
    if (g.scope === "whatsapp_business_management") {
      for (const id of g.target_ids ?? []) wabaIds.add(id);
    }
  }

  return {
    isValid: data?.is_valid === true,
    appId: data?.app_id ?? null,
    expiresAt: data?.expires_at ?? 0,
    scopes: data?.scopes ?? [],
    wabaIds: Array.from(wabaIds),
    invalidReason: data?.error?.message ?? null,
  };
}

/** Números de una cuenta de WhatsApp Business (para elegir el correcto si hay varios). */
export async function listWhatsAppPhoneNumbers({
  wabaId,
  accessToken,
}: {
  wabaId: string;
  accessToken: string;
}): Promise<Array<{ id: string; displayPhoneNumber: string; verifiedName: string }>> {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const bodyText = await response.text();

  if (!response.ok) {
    throw graphError("[whatsapp] Graph API error:", bodyText);
  }

  let parsed: {
    data?: Array<{ id?: string; display_phone_number?: string; verified_name?: string }>;
  } | null = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = null;
  }

  return (parsed?.data ?? [])
    .filter((n): n is { id: string; display_phone_number?: string; verified_name?: string } =>
      Boolean(n.id),
    )
    .map((n) => ({
      id: n.id,
      displayPhoneNumber: n.display_phone_number || "",
      verifiedName: n.verified_name || "",
    }));
}

/** Suscribe la App a los eventos de esa cuenta de WhatsApp Business (`POST /{waba}/subscribed_apps`). */
export async function subscribeAppToWaba({
  wabaId,
  accessToken,
}: {
  wabaId: string;
  accessToken: string;
}): Promise<void> {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/subscribed_apps`,
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    throw graphError("[whatsapp] Graph API error:", await response.text());
  }
}

/**
 * Configura el webhook de la App (`POST /{appId}/subscriptions`, autenticado con `appId|appSecret`):
 * es lo que evita que la empresa tenga que pegar la Callback URL y el Verify Token a mano en su
 * panel de Meta. NO publica la App: en modo desarrollo Meta sigue sin entregar mensajes reales.
 * (No verificado con una llamada real todavía: si falla, el front cae al modo manual.)
 */
export async function configureAppWebhook({
  appId,
  appSecret,
  callbackUrl,
  verifyToken,
}: {
  appId: string;
  appSecret: string;
  callbackUrl: string;
  verifyToken: string;
}): Promise<void> {
  const body = new URLSearchParams({
    object: "whatsapp_business_account",
    callback_url: callbackUrl,
    verify_token: verifyToken,
    fields: "messages,message_template_status_update",
    access_token: `${appId}|${appSecret}`,
  });
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${appId}/subscriptions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!response.ok) {
    throw graphError("[whatsapp] Graph API error:", await response.text());
  }
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
