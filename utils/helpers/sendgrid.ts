import sgMail from "@sendgrid/mail";

/**
 * Initialize SendGrid with API key from environment variables
 */
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send an email using SendGrid
 */
export async function sendEmail({
  to,
  subject,
  html,
  from = process.env.SENDGRID_FROM_EMAIL || "noreply@kadesh.com",
}: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("SENDGRID_API_KEY is not configured. Email not sent.");
    return;
  }

  try {
    const msg = {
      to: Array.isArray(to) ? to : [to],
      from,
      subject,
      html,
    };

    await sgMail.send(msg);
    console.log(
      `Email sent successfully to ${Array.isArray(to) ? to.join(", ") : to}`,
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    if (error.response) {
      console.error("SendGrid error response:", error.response.body);
    }
    throw error;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BRAND_ORANGE = "#FF8C42";
const BRAND_ORANGE_DARK = "#E6732E";

function parseAdminNotificationEmails(): string[] {
  const raw = process.env.SENDGRID_FROM_EMAIL?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

function buildWelcomeEmailHtml(displayName: string, appUrl?: string): string {
  const name = escapeHtml(displayName || "ahí");
  const ctaRow = appUrl
    ? `
        <tr>
          <td style="padding: 8px 0 0 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0;">
              <tr>
                <td style="border-radius: 8px; background: ${BRAND_ORANGE};">
                  <a href="${escapeHtml(appUrl)}" target="_blank" rel="noopener noreferrer"
                    style="display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                    Ir a la plataforma
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Bienvenido</title>
</head>
<body style="margin:0; padding:0; background-color:#eef0f4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef0f4; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_ORANGE} 0%, ${BRAND_ORANGE_DARK} 100%); padding: 28px 32px;">
              <p style="margin:0; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.9);">Kadesh</p>
              <h1 style="margin: 8px 0 0 0; font-size: 26px; font-weight: 700; line-height: 1.25; color: #ffffff;">¡Bienvenido!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 28px 32px;">
              <p style="margin:0 0 16px 0; font-size: 18px; line-height: 1.5; color: #0f172a;">Hola <strong>${name}</strong>,</p>
              <p style="margin:0 0 20px 0; font-size: 16px; line-height: 1.65; color: #475569;">
                Gracias por unirte. Tu cuenta ya está activa y puedes empezar a usar la plataforma cuando quieras.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${ctaRow}
                <tr>
                  <td style="padding-top: 28px; border-top: 1px solid #e2e8f0;">
                    <p style="margin:0; font-size: 14px; line-height: 1.6; color: #64748b;">
                      Si no creaste esta cuenta, puedes ignorar este mensaje.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px 28px 32px; background: #f8fafc;">
              <p style="margin:0; font-size: 13px; line-height: 1.5; color: #94a3b8; text-align: center;">
                © ${new Date().getFullYear()} Kadesh · Equipo de soporte
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildBankAlertEmailHtml(
  userId: string,
  userName: string,
  userEmail: string,
  fieldsList: string,
): string {
  const rows = [
    ["ID de usuario", userId],
    ["Nombre", userName],
    ["Email", userEmail],
    ["Campos actualizados", fieldsList],
  ] as const;

  const tableRows = rows
    .map(
      ([label, value]) => `
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #334155; font-size: 13px; font-weight: 600; color: #94a3b8; width: 38%; vertical-align: top;">${escapeHtml(label)}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #334155; font-size: 14px; color: #e2e8f0; vertical-align: top;">${escapeHtml(value)}</td>
          </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background: #1e293b; border-radius: 14px; overflow: hidden; border: 1px solid #334155;">
          <tr>
            <td style="padding: 22px 24px; border-bottom: 1px solid #334155;">
              <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; background: rgba(255,140,66,0.2); color: ${BRAND_ORANGE}; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;">Alerta admin</span>
              <h1 style="margin: 12px 0 0 0; font-size: 20px; font-weight: 700; color: #f8fafc;">Datos bancarios actualizados</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 1.5; color: #94a3b8;">Un usuario guardó cambios en banco, CLABE o tarjeta. Revisa el registro en el Admin de Keystone.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${tableRows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 24px 24px 24px;">
              <p style="margin:0; font-size: 12px; color: #64748b; line-height: 1.5;">Este mensaje se generó automáticamente. No respondas a este correo.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Correo de bienvenida al registrarse (create User).
 * Requiere SENDGRID_API_KEY y email válido del usuario.
 */
export async function sendUserWelcomeEmail({
  to,
  displayName,
}: {
  to: string;
  displayName: string;
}): Promise<void> {
  const trimmedTo = to?.trim();
  if (!trimmedTo) {
    console.warn("sendUserWelcomeEmail: sin email destino.");
    return;
  }

  const subject = "Bienvenido a Kadesh";
  const appUrl = "https://negocios.kadesh.com.mx/auth/login";
  const html = buildWelcomeEmailHtml(displayName, appUrl);

  await sendEmail({ to: trimmedTo, subject, html });
}

/**
 * Notifica al admin cuando un usuario actualiza banco, CLABE o número de tarjeta.
 * Configura SENDGRID_FROM_EMAIL (coma para varios) y SENDGRID_API_KEY.
 */
export async function sendAdminUserBankDetailsUpdatedEmail({
  userId,
  userEmail,
  userName,
  fieldsUpdated,
}: {
  userId: string;
  userEmail: string;
  userName: string;
  fieldsUpdated: string[];
}): Promise<void> {
  const recipients = parseAdminNotificationEmails();
  if (recipients.length === 0) {
    console.warn(
      "SENDGRID_FROM_EMAIL no configurado. No se envía aviso de datos bancarios.",
    );
    return;
  }

  const fieldsList = fieldsUpdated.join(", ");
  const subject = "[Kadesh] Usuario actualizó datos bancarios";
  const html = buildBankAlertEmailHtml(userId, userName, userEmail, fieldsList);

  await sendEmail({ to: recipients, subject, html });
}

/**
 * Send email notification for new blog post
 */
export async function sendNewPostEmail({
  postTitle,
  postUrl,
  postExcerpt,
  authorName,
  categoryName,
  recipientEmails,
}: {
  postTitle: string;
  postUrl: string;
  postExcerpt?: string | null;
  authorName?: string | null;
  categoryName?: string | null;
  recipientEmails: string[];
}): Promise<void> {
  if (recipientEmails.length === 0) {
    return;
  }

  const subject = `Nuevo post publicado: ${postTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="color-scheme" content="dark">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #BBBBBB;
          background-color: #1A1A1A;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #FF8C42;
          color: #FFFFFF;
          padding: 20px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
        }
        .content {
          background-color: #2C2C2C;
          padding: 20px;
          border-radius: 0 0 5px 5px;
          border: 1px solid #404040;
          border-top: none;
        }
        .post-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 15px;
          color: #FFFFFF;
        }
        .post-excerpt {
          font-size: 16px;
          color: #BBBBBB;
          margin-bottom: 20px;
          line-height: 1.8;
        }
        .post-meta {
          font-size: 14px;
          color: #87CEEB;
          margin-bottom: 20px;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background-color: #FF8C42;
          color: #FFFFFF;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          margin-top: 20px;
        }
        .button:hover {
          background-color: #E67A35;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #404040;
          font-size: 12px;
          color: #BBBBBB;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>¡Nuevo Post Publicado!</h1>
      </div>
      <div class="content">
        <div class="post-title">${postTitle}</div>
        ${postExcerpt ? `<div class="post-excerpt">${postExcerpt}</div>` : ""}
        <div class="post-meta">
          ${authorName ? `<strong>Autor:</strong> ${authorName}<br>` : ""}
          ${categoryName ? `<strong>Categoría:</strong> ${categoryName}` : ""}
        </div>
        <a href="${postUrl}" class="button">Leer Post Completo</a>
      </div>
      <div class="footer">
        <p>Gracias por suscribirte a nuestro blog.</p>
        <p>Si no deseas recibir más notificaciones, puedes cancelar tu suscripción en cualquier momento.</p>
      </div>
    </body>
    </html>
  `;

  for (const email of recipientEmails) {
    await sendEmail({
      to: email,
      subject,
      html,
    });
  }
}
