const MAILTRAP_SEND_URL =
  process.env.MAILTRAP_SEND_URL?.trim() || "https://send.api.mailtrap.io/api/send";

const PLACEHOLDER_PASS = new Set(["<tu_password>", "your_smtp_password", "changeme"]);

function mailEnv() {
  return {
    apiToken:
      process.env.MAILTRAP_API_TOKEN?.trim() || process.env.SMTP_PASS?.trim(),
    from: process.env.SMTP_FROM?.trim()?.split(",")[0]?.trim(),
    fromName: process.env.SMTP_FROM_NAME?.trim(),
  };
}

function isPlaceholderToken(token: string | undefined): boolean {
  if (!token) return true;
  const lower = token.toLowerCase();
  return PLACEHOLDER_PASS.has(lower) || lower.includes("your_smtp") || lower.includes("<tu_");
}

export function isSmtpConfigured(): boolean {
  const { apiToken, from } = mailEnv();
  return Boolean(apiToken && from && !isPlaceholderToken(apiToken));
}

/** RFC 5322 From with display name (shown as sender in Gmail, Apple Mail, etc.). */
export function formatMailFrom(displayName: string | undefined, address: string): string {
  const email = address.trim();
  const name = displayName?.trim();
  if (!name) {
    return email;
  }
  const escaped = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}" <${email}>`;
}

function resolveFrom(
  from?: string,
  fromName?: string,
): { email: string; name?: string } | undefined {
  const address = from?.trim() || mailEnv().from;
  if (!address) {
    return undefined;
  }
  const name = fromName?.trim() || mailEnv().fromName;
  return { email: address, name: name || undefined };
}

type MailtrapSendResponse = {
  success?: boolean;
  message?: string;
  errors?: string[];
};

async function sendViaMailtrapApi(payload: {
  from: { email: string; name?: string };
  to: { email: string }[];
  subject: string;
  html: string;
}): Promise<void> {
  const { apiToken } = mailEnv();
  if (!apiToken) {
    throw new Error("[mail] MAILTRAP_API_TOKEN o SMTP_PASS es obligatorio");
  }

  const response = await fetch(MAILTRAP_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  let body: MailtrapSendResponse | null = null;
  if (bodyText) {
    try {
      body = JSON.parse(bodyText) as MailtrapSendResponse;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const detail =
      body?.errors?.join("; ") ||
      body?.message ||
      bodyText ||
      `HTTP ${response.status}`;
    throw new Error(`[mail] Mailtrap API error: ${detail}`);
  }
}

/**
 * Sends a transactional email via Mailtrap Send API (HTTPS).
 * Requires MAILTRAP_API_TOKEN (or SMTP_PASS) and SMTP_FROM.
 */
export async function sendEmail({
  to,
  subject,
  html,
  from,
  fromName,
}: {
  to: string | string[];
  subject: string;
  html: string;
  /** Sender address (defaults to SMTP_FROM). */
  from?: string;
  /** Display name in the inbox. Overrides SMTP_FROM_NAME. */
  fromName?: string;
}): Promise<void> {
  const resolvedFrom = resolveFrom(from, fromName);

  if (!isSmtpConfigured()) {
    console.warn(
      "[mail] Mailtrap no configurado. Define MAILTRAP_API_TOKEN (o SMTP_PASS) y SMTP_FROM.",
    );
    return;
  }

  if (!resolvedFrom) {
    console.warn("[mail] SMTP_FROM no configurado. Correo no enviado.");
    return;
  }

  const recipients = (Array.isArray(to) ? to : [to]).map((e) => e.trim()).filter(Boolean);
  if (recipients.length === 0) {
    console.warn("[mail] Sin destinatarios válidos.");
    return;
  }

  try {
    await sendViaMailtrapApi({
      from: resolvedFrom,
      to: recipients.map((email) => ({ email })),
      subject,
      html,
    });
  } catch (err: unknown) {
    console.error("[mail] Error al enviar correo:", err);
    throw err;
  }
}
