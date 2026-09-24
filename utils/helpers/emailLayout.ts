/**
 * Layout y componentes compartidos de los correos transaccionales.
 * Todo con tablas + estilos inline para que se vea igual en Gmail, Outlook y Apple Mail.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Marca de cada producto en los correos: nombre, colores y URL de login. */
export const EMAIL_BRANDS = {
  pet: {
    name: "Kadesh Pet",
    tagline: "El cuidado de tu mascota, en un solo lugar",
    color: "#216BFA",
    dark: "#1C5CD7",
    soft: "#EAF1FF",
    appUrl: () =>
      process.env.PET_FRONTEND_URL?.trim() ||
      process.env.FRONTEND_URL?.trim() ||
      "https://pet.kadesh.com.mx/auth/login",
  },
  saas: {
    name: "Kadesh Negocios",
    tagline: "Gestiona tu negocio sin complicaciones",
    color: "#FF8C42",
    dark: "#E6732E",
    soft: "#FFF1E6",
    appUrl: () =>
      process.env.SAAS_FRONTEND_URL?.trim() ||
      "https://kadesh.com.mx/auth/login",
  },
} as const;

export type EmailBrand = keyof typeof EMAIL_BRANDS;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const EMAIL_TEXT = {
  heading: "#0f172a",
  body: "#475569",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  surface: "#f8fafc",
  page: "#eef0f4",
} as const;

/** Botón "a prueba de Outlook": tabla con fondo + enlace con padding. */
export function emailButton(
  brand: EmailBrand,
  label: string,
  href: string,
): string {
  const { color } = EMAIL_BRANDS[brand];
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0 0;">
    <tr>
      <td align="center" bgcolor="${color}" style="border-radius:10px;background:${color};">
        <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"
          style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
          ${escapeHtml(label)} &rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

/** Tabla de datos clave/valor. Los valores ya deben venir escapados. */
export function emailInfoTable(rows: ReadonlyArray<[string, string]>): string {
  const body = rows
    .map(
      ([label, value], i) => `
      <tr>
        <td style="padding:12px 16px;${i < rows.length - 1 ? `border-bottom:1px solid ${EMAIL_TEXT.line};` : ""}font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:${EMAIL_TEXT.muted};width:36%;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:12px 16px;${i < rows.length - 1 ? `border-bottom:1px solid ${EMAIL_TEXT.line};` : ""}font-family:${FONT};font-size:15px;font-weight:500;color:${EMAIL_TEXT.heading};vertical-align:top;">${value}</td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0 0;background:${EMAIL_TEXT.surface};border:1px solid ${EMAIL_TEXT.line};border-radius:12px;border-collapse:separate;">${body}</table>`;
}

/** Recuadro destacado con borde de color de la marca. Contenido ya escapado. */
export function emailCallout(brand: EmailBrand, html: string): string {
  const { color, soft } = EMAIL_BRANDS[brand];
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0 0;">
    <tr>
      <td style="padding:16px 18px;background:${soft};border-left:4px solid ${color};border-radius:8px;font-family:${FONT};font-size:15px;line-height:1.65;color:${EMAIL_TEXT.body};">${html}</td>
    </tr>
  </table>`;
}

/** Píldora de estado / etiqueta. */
export function emailPill(brand: EmailBrand, text: string): string {
  const { color, soft } = EMAIL_BRANDS[brand];
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${soft};color:${color};font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(text)}</span>`;
}

export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.7;color:${EMAIL_TEXT.body};">${html}</p>`;
}

export function emailGreeting(name: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:20px;line-height:1.4;color:${EMAIL_TEXT.heading};">Hola <strong>${escapeHtml(name)}</strong> 👋</p>`;
}

export function renderEmailLayout(params: {
  brand: EmailBrand;
  /** Texto de vista previa en la bandeja de entrada (no se ve dentro del correo). */
  preheader: string;
  /** Etiqueta pequeña sobre el título, p. ej. "Nueva cita". */
  eyebrow?: string;
  title: string;
  /** HTML del cuerpo (ya escapado). */
  bodyHtml: string;
  /** Texto legal del pie, p. ej. "Recibiste este correo porque…". */
  footerNote?: string;
  /** HTML extra del pie, p. ej. enlace para darse de baja. */
  footerExtraHtml?: string;
}): string {
  const { name, tagline, color, dark } = EMAIL_BRANDS[params.brand];
  const title = escapeHtml(params.title);
  const year = new Date().getFullYear();

  const eyebrow = params.eyebrow
    ? `<p style="margin:0 0 10px 0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);">${escapeHtml(params.eyebrow)}</p>`
    : "";

  const footerNote = params.footerNote
    ? `<p style="margin:0 0 10px 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${EMAIL_TEXT.muted};">${escapeHtml(params.footerNote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_TEXT.page};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(params.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${EMAIL_TEXT.page};">
    <tr>
      <td align="center" style="padding:32px 16px 40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
          <tr>
            <td style="padding:0 4px 16px 4px;font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:-0.01em;color:${EMAIL_TEXT.heading};">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;"></span>${escapeHtml(name)}
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.08);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td bgcolor="${color}" style="background:${color};background-image:linear-gradient(135deg,${color} 0%,${dark} 100%);padding:36px 36px 32px 36px;">
                    ${eyebrow}
                    <h1 style="margin:0;font-family:${FONT};font-size:28px;font-weight:800;line-height:1.25;color:#ffffff;">${title}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px 36px 40px 36px;">
                    ${params.bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 16px 0 16px;">
              ${footerNote}
              ${params.footerExtraHtml ?? ""}
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${EMAIL_TEXT.faint};">
                <strong style="color:${EMAIL_TEXT.muted};">${escapeHtml(name)}</strong> · ${escapeHtml(tagline)}<br>
                © ${year} Kadesh. Todos los derechos reservados.
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
