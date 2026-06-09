import { KeystoneContext } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../../models/Role/constants";
import { isSmtpConfigured, sendEmail } from "../../../utils/intregrations/smtpMail";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function smtpDiagnostics(): { host: string | null; port: number | null; configured: boolean } {
  const host = process.env.SMTP_HOST?.trim() || null;
  const portRaw = process.env.SMTP_PORT?.trim();
  const port = portRaw ? Number(portRaw) : 465;
  return {
    host,
    port: Number.isFinite(port) ? port : null,
    configured: isSmtpConfigured(),
  };
}

function formatSmtpError(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }
  const code = (err as { code?: string }).code;
  return code ? `${err.message} (${code})` : err.message;
}

function buildTestEmailHtml(): string {
  const sentAt = new Date().toISOString();
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
      <h2 style="margin: 0 0 12px 0; color: #FF8C42;">Correo de prueba — Kadesh</h2>
      <p style="margin: 0 0 8px 0;">Si ves este mensaje, el envío SMTP desde el backend funcionó correctamente.</p>
      <p style="margin: 0; font-size: 13px; color: #64748b;">Enviado: ${sentAt}</p>
    </div>
  `;
}

const typeDefs = `
  type SendTestEmailResult {
    success: Boolean!
    message: String!
    recipient: String
    smtpHost: String
    smtpPort: Int
    smtpConfigured: Boolean!
  }

  type Mutation {
    sendTestEmail(email: String!): SendTestEmailResult!
  }
`;

const definition = `
  sendTestEmail(email: String!): SendTestEmailResult!
`;

const resolver = {
  sendTestEmail: async (
    _root: unknown,
    { email }: { email: string },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    const diagnostics = smtpDiagnostics();

    if (!hasRole(session, [Role.ADMIN])) {
      return {
        success: false,
        message: "Solo administradores pueden enviar correos de prueba",
        recipient: null,
        smtpHost: diagnostics.host,
        smtpPort: diagnostics.port,
        smtpConfigured: diagnostics.configured,
      };
    }

    const recipient = email?.trim();
    if (!recipient || !EMAIL_REGEX.test(recipient)) {
      return {
        success: false,
        message: "Proporciona un correo electrónico válido",
        recipient: recipient || null,
        smtpHost: diagnostics.host,
        smtpPort: diagnostics.port,
        smtpConfigured: diagnostics.configured,
      };
    }

    if (!diagnostics.configured) {
      return {
        success: false,
        message:
          "SMTP no configurado. Revisa SMTP_HOST, SMTP_USER, SMTP_PASS y SMTP_FROM en las variables de entorno.",
        recipient,
        smtpHost: diagnostics.host,
        smtpPort: diagnostics.port,
        smtpConfigured: false,
      };
    }

    try {
      await sendEmail({
        to: recipient,
        subject: "Prueba SMTP — Kadesh",
        html: buildTestEmailHtml(),
        fromName: process.env.SMTP_FROM_NAME?.trim() || "Kadesh",
      });

      return {
        success: true,
        message: `Correo de prueba enviado a ${recipient}`,
        recipient,
        smtpHost: diagnostics.host,
        smtpPort: diagnostics.port,
        smtpConfigured: true,
      };
    } catch (err) {
      return {
        success: false,
        message: formatSmtpError(err),
        recipient,
        smtpHost: diagnostics.host,
        smtpPort: diagnostics.port,
        smtpConfigured: true,
      };
    }
  },
};

export default { typeDefs, definition, resolver };
