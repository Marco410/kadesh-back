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
