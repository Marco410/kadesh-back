import nodemailer, { type Transporter } from "nodemailer";

const PLACEHOLDER_PASS = new Set(["<tu_password>", "your_smtp_password", "changeme"]);

function smtpEnv() {
  return {
    host: process.env.SMTP_HOST?.trim(),
    port: Number(process.env.SMTP_PORT ?? "465"),
    secure:
      process.env.SMTP_SECURE?.trim().toLowerCase() !== "false" &&
      Number(process.env.SMTP_PORT ?? "465") === 465,
    user: process.env.SMTP_USER?.trim(),
    pass: process.env.SMTP_PASS?.trim(),
    from: process.env.SMTP_FROM?.trim()?.split(",")[0]?.trim() || process.env.SMTP_USER?.trim(),
  };
}

function isPlaceholderPassword(pass: string | undefined): boolean {
  if (!pass) return true;
  const lower = pass.toLowerCase();
  return PLACEHOLDER_PASS.has(lower) || lower.includes("your_smtp") || lower.includes("<tu_");
}

export function isSmtpConfigured(): boolean {
  const { host, user, pass, from } = smtpEnv();
  return Boolean(host && user && pass && from && !isPlaceholderPassword(pass));
}

let transporter: Transporter | null = null;
let transporterKey: string | null = null;

function getTransporter(): Transporter {
  const { host, port, secure, user, pass } = smtpEnv();

  if (!host || !user || !pass) {
    throw new Error("[smtp] SMTP_HOST, SMTP_USER y SMTP_PASS son obligatorios");
  }

  if (isPlaceholderPassword(pass)) {
    throw new Error(
      "[smtp] SMTP_PASS sigue siendo un placeholder. Pon la contraseña real del buzón en config/.env.dev (usa comillas si tiene %, &, etc.).",
    );
  }

  const key = `${host}:${port}:${secure}:${user}`;
  if (transporter && transporterKey === key) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 465,
    secure,
    auth: { user, pass },
  });
  transporterKey = key;

  return transporter;
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

function resolveFromAddress(
  from?: string,
  fromName?: string,
): string | undefined {
  const address = from?.trim() || smtpEnv().from;
  if (!address) {
    return undefined;
  }
  const name = fromName?.trim() || process.env.SMTP_FROM_NAME?.trim();
  return formatMailFrom(name, address);
}

function smtpAuthHint(err: unknown): string | undefined {
  const code = (err as { code?: string })?.code;
  const responseCode = (err as { responseCode?: number })?.responseCode;
  if (code === "EAUTH" || responseCode === 535) {
    const { user } = smtpEnv();
    return `Revisa SMTP_USER (${user ?? "?"}) y SMTP_PASS en config/.env.dev — la contraseña debe ir entre comillas si tiene caracteres especiales (%, &, #). Reinicia pnpm dev tras cambiar el .env.`;
  }
  return undefined;
}

/**
 * Sends an email via the Lnkap SMTP server.
 * Requires SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM (or SMTP_USER as from).
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
  /** SMTP envelope address (defaults to SMTP_FROM / SMTP_USER). */
  from?: string;
  /** Display name in the inbox (e.g. "Verificación Lnkap"). Overrides SMTP_FROM_NAME. */
  fromName?: string;
}): Promise<void> {
  const resolvedFrom = resolveFromAddress(from, fromName);

  if (!isSmtpConfigured()) {
    console.warn("[smtp] SMTP no configurado o SMTP_PASS es placeholder. Correo no enviado.");
    return;
  }

  if (!resolvedFrom) {
    console.warn("[smtp] SMTP_FROM no configurado. Correo no enviado.");
    return;
  }

  const recipients = (Array.isArray(to) ? to : [to]).map((e) => e.trim()).filter(Boolean);
  if (recipients.length === 0) {
    console.warn("[smtp] Sin destinatarios válidos.");
    return;
  }

  try {
    await getTransporter().sendMail({
      from: resolvedFrom,
      to: recipients.join(", "),
      subject,
      html,
    });
  } catch (err: unknown) {
    const hint = smtpAuthHint(err);
    console.error("[smtp] Error al enviar correo:", err);
    if (hint) {
      console.error(`[smtp] ${hint}`);
    }
    throw err;
  }
}
