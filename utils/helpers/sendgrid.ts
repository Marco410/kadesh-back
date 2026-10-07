import { sendEmail } from "../intregrations/smtpMail";
import {
  EMAIL_BRANDS,
  EMAIL_TEXT,
  emailButton,
  emailCallout,
  emailGreeting,
  emailInfoTable,
  emailParagraph,
  emailPill,
  escapeHtml,
  renderEmailLayout,
  type EmailBrand,
} from "./emailLayout";

export { sendEmail };
export type { EmailBrand };

/** Producto de un usuario: con empresa es Negocios (SaaS), sin empresa es Pet. */
export function emailBrandForUser(hasCompany: boolean): EmailBrand {
  return hasCompany ? "saas" : "pet";
}

function parseAdminNotificationEmails(): string[] {
  const raw =
    process.env.SMTP_ADMIN_NOTIFICATION_EMAILS?.trim() ||
    process.env.SENDGRID_FROM_EMAIL?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const SECTION_LABEL_STYLE = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${EMAIL_TEXT.muted};`;

function buildWelcomeEmailHtml(displayName: string, brand: EmailBrand): string {
  const { name: brandName, color, soft } = EMAIL_BRANDS[brand];
  const steps =
    brand === "saas"
      ? [
          "Configura los datos de tu negocio",
          "Agrega a tu equipo y tus servicios",
          "Empieza a gestionar clientes y agenda",
        ]
      : [
          "Registra a tu mascota",
          "Explora clínicas y servicios cerca de ti",
          "Agenda citas y guarda su historial",
        ];

  const stepsHtml = steps
    .map(
      (step, i) => `
      <tr>
        <td valign="top" style="padding:0 14px 14px 0;width:32px;">
          <div style="width:28px;height:28px;line-height:28px;border-radius:50%;background:${soft};color:${color};font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-align:center;">${i + 1}</div>
        </td>
        <td valign="top" style="padding:3px 0 14px 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:${EMAIL_TEXT.heading};">${escapeHtml(step)}</td>
      </tr>`,
    )
    .join("");

  return renderEmailLayout({
    brand,
    preheader: `Tu cuenta en ${brandName} ya está lista.`,
    eyebrow: "Cuenta creada",
    title: "¡Bienvenido a bordo!",
    bodyHtml: `
      ${emailGreeting(displayName || "ahí")}
      ${emailParagraph(
        `Gracias por unirte a <strong>${escapeHtml(brandName)}</strong>. Tu cuenta ya está activa y lista para usarse.`,
      )}
      <p style="margin:24px 0 14px 0;${SECTION_LABEL_STYLE}">Para empezar</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0">${stepsHtml}</table>
      ${emailButton(brand, "Ir a la plataforma", EMAIL_BRANDS[brand].appUrl())}`,
    footerNote:
      "Si no creaste esta cuenta, puedes ignorar este mensaje con tranquilidad.",
  });
}

function buildBankAlertEmailHtml(
  userId: string,
  userName: string,
  userEmail: string,
  fieldsList: string,
  brand: EmailBrand,
): string {
  return renderEmailLayout({
    brand,
    preheader: `${userName} actualizó sus datos bancarios.`,
    eyebrow: `Alerta admin · ${EMAIL_BRANDS[brand].name}`,
    title: "Datos bancarios actualizados",
    bodyHtml: `
      ${emailParagraph(
        "Un usuario guardó cambios en banco, CLABE o tarjeta. Revisa el registro en el Admin de Keystone.",
      )}
      ${emailInfoTable([
        ["ID de usuario", escapeHtml(userId)],
        ["Nombre", escapeHtml(userName)],
        ["Email", escapeHtml(userEmail)],
        ["Campos", escapeHtml(fieldsList)],
      ])}`,
    footerNote: "Mensaje automático. No respondas a este correo.",
  });
}

/**
 * Correo de bienvenida al registrarse (create User).
 * Requiere Mailtrap API (MAILTRAP_API_TOKEN o SMTP_PASS) y SMTP_FROM configurados.
 */
export async function sendUserWelcomeEmail({
  to,
  displayName,
  brand,
}: {
  to: string;
  displayName: string;
  brand: EmailBrand;
}): Promise<void> {
  const trimmedTo = to?.trim();
  if (!trimmedTo) {
    console.warn("sendUserWelcomeEmail: sin email destino.");
    return;
  }

  const { name: brandName } = EMAIL_BRANDS[brand];
  await sendEmail({
    to: trimmedTo,
    subject: `Bienvenido a ${brandName}`,
    html: buildWelcomeEmailHtml(displayName, brand),
    fromName: brandName,
  });
}

/**
 * Notifica al admin cuando un usuario actualiza banco, CLABE o número de tarjeta.
 * Configura SMTP_ADMIN_NOTIFICATION_EMAILS (coma para varios) y Mailtrap API.
 */
export async function sendAdminUserBankDetailsUpdatedEmail({
  userId,
  userEmail,
  userName,
  fieldsUpdated,
  brand,
}: {
  userId: string;
  userEmail: string;
  userName: string;
  fieldsUpdated: string[];
  brand: EmailBrand;
}): Promise<void> {
  const recipients = parseAdminNotificationEmails();
  if (recipients.length === 0) {
    console.warn(
      "SMTP_ADMIN_NOTIFICATION_EMAILS no configurado. No se envía aviso de datos bancarios.",
    );
    return;
  }

  const { name: brandName } = EMAIL_BRANDS[brand];
  await sendEmail({
    to: recipients,
    subject: `[${brandName}] Usuario actualizó datos bancarios`,
    html: buildBankAlertEmailHtml(
      userId,
      userName,
      userEmail,
      fieldsUpdated.join(", "),
      brand,
    ),
    fromName: brandName,
  });
}

export async function sendAdminPetPlaceServiceRequestEmail({
  serviceName,
  description,
  petPlaceName,
  petPlaceId,
  requesterName,
  requesterEmail,
}: {
  serviceName: string;
  description?: string;
  petPlaceName: string;
  petPlaceId: string;
  requesterName: string;
  requesterEmail: string;
}): Promise<void> {
  const recipients = parseAdminNotificationEmails();
  if (recipients.length === 0) {
    console.warn(
      "SMTP_ADMIN_NOTIFICATION_EMAILS no configurado. No se envía aviso de servicio nuevo.",
    );
    return;
  }

  const brand: EmailBrand = "pet";
  const { name: brandName } = EMAIL_BRANDS[brand];

  const html = renderEmailLayout({
    brand,
    preheader: `${requesterName} pidió agregar "${serviceName}" a ${petPlaceName}.`,
    eyebrow: "Pendiente de aprobación",
    title: "Nuevo servicio para revisar",
    bodyHtml: `
      ${emailParagraph(
        `<strong>${escapeHtml(requesterName)}</strong> pidió agregar un servicio a <strong>${escapeHtml(petPlaceName)}</strong>.`,
      )}
      ${emailInfoTable([
        ["Servicio", escapeHtml(serviceName)],
        ["Descripción", escapeHtml(description || "(sin descripción)")],
        ["Solicitante", escapeHtml(requesterName)],
        ["Correo", escapeHtml(requesterEmail || "(sin correo)")],
        ["ID de clínica", escapeHtml(petPlaceId)],
      ])}
      ${emailCallout(
        brand,
        "Apruébalo o recházalo en Keystone → <strong>PetPlaceService</strong>. Solo si lo apruebas aparece en el catálogo.",
      )}`,
    footerNote: "Mensaje automático. No respondas a este correo.",
  });

  await sendEmail({
    to: recipients,
    subject: `[${brandName}] Nuevo servicio para revisar: ${serviceName}`,
    html,
    fromName: brandName,
  });
}

/**
 * Aviso a admin cuando un usuario no-admin registra un Animal.
 * Destinatarios: SMTP_ADMIN_NOTIFICATION_EMAILS.
 */
export async function sendAdminNewAnimalEmail({
  animalId,
  animalName,
  animalType,
  slug,
  publicUrl,
  creatorName,
  creatorEmail,
}: {
  animalId: string;
  animalName: string;
  animalType?: string;
  slug?: string;
  publicUrl?: string;
  creatorName: string;
  creatorEmail: string;
}): Promise<void> {
  const recipients = parseAdminNotificationEmails();
  if (recipients.length === 0) {
    console.warn(
      "SMTP_ADMIN_NOTIFICATION_EMAILS no configurado. No se envía aviso de animal nuevo.",
    );
    return;
  }

  const brand: EmailBrand = "pet";
  const { name: brandName } = EMAIL_BRANDS[brand];

  const rows: [string, string][] = [
    ["Nombre", escapeHtml(animalName)],
    ["Tipo", escapeHtml(animalType || "(sin tipo)")],
    ["Slug", escapeHtml(slug || "(pendiente)")],
    ["ID", escapeHtml(animalId)],
    ["Creado por", escapeHtml(creatorName)],
    ["Correo", escapeHtml(creatorEmail || "(sin correo)")],
  ];

  const html = renderEmailLayout({
    brand,
    preheader: `${creatorName} registró el animal "${animalName}".`,
    eyebrow: "Nuevo registro",
    title: "Alguien agregó un animal",
    bodyHtml: `
      ${emailParagraph(
        `<strong>${escapeHtml(creatorName)}</strong> registró un animal nuevo en Kadesh Pet.`,
      )}
      ${emailInfoTable(rows)}
      ${
        publicUrl
          ? emailButton(brand, "Ver en la app", publicUrl)
          : emailCallout(
              brand,
              "Revísalo en Keystone → <strong>Animal</strong>.",
            )
      }`,
    footerNote: "Mensaje automático. No respondas a este correo.",
  });

  await sendEmail({
    to: recipients,
    subject: `[${brandName}] Nuevo animal: ${animalName}`,
    html,
    fromName: brandName,
  });
}

export type NewPostEmailBrand = EmailBrand;

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
  brand = "pet",
  unsubscribeBaseUrl,
}: {
  postTitle: string;
  postUrl: string;
  postExcerpt?: string | null;
  authorName?: string | null;
  categoryName?: string | null;
  recipientEmails: string[];
  brand?: NewPostEmailBrand;
  /** Página del front donde se da de baja; se le agrega `?email=` de cada destinatario. */
  unsubscribeBaseUrl?: string;
}): Promise<void> {
  if (recipientEmails.length === 0) {
    return;
  }

  const { name: brandName, color } = EMAIL_BRANDS[brand];
  const subject = `Nuevo artículo en ${brandName}: ${postTitle}`;
  const excerpt = postExcerpt ? stripTags(postExcerpt) : "";

  const meta = [
    categoryName ? emailPill(brand, categoryName) : "",
    authorName
      ? `<span style="font-family:Arial,sans-serif;font-size:14px;color:${EMAIL_TEXT.muted};">Por <strong style="color:${EMAIL_TEXT.heading};">${escapeHtml(authorName)}</strong></span>`
      : "",
  ]
    .filter(Boolean)
    .join(`<span style="display:inline-block;width:10px;"></span>`);

  const buildHtml = (unsubscribeUrl: string | null) =>
    renderEmailLayout({
      brand,
      preheader: excerpt || `Ya puedes leer "${postTitle}".`,
      eyebrow: "Nuevo en el blog",
      title: postTitle,
      bodyHtml: `
        ${meta ? `<div style="margin:0 0 20px 0;">${meta}</div>` : ""}
        ${
          excerpt
            ? `<p style="margin:0;padding:0 0 0 16px;border-left:4px solid ${color};font-family:Arial,sans-serif;font-size:17px;line-height:1.7;color:${EMAIL_TEXT.body};">${escapeHtml(excerpt)}</p>`
            : ""
        }
        ${emailButton(brand, "Leer artículo completo", postUrl)}`,
      footerNote: "Recibes este correo porque te suscribiste a nuestro blog.",
      footerExtraHtml: unsubscribeUrl
        ? `<p style="margin:0 0 14px 0;font-family:Arial,sans-serif;font-size:13px;color:${EMAIL_TEXT.muted};"><a href="${escapeHtml(unsubscribeUrl)}" style="color:${EMAIL_TEXT.muted};text-decoration:underline;">Cancelar suscripción</a></p>`
        : "",
    });

  for (const email of recipientEmails) {
    const unsubscribeUrl = unsubscribeBaseUrl
      ? `${unsubscribeBaseUrl}?email=${encodeURIComponent(email)}`
      : null;

    await sendEmail({
      to: email,
      subject,
      html: buildHtml(unsubscribeUrl),
      fromName: brandName,
    });
  }
}

function formatReleaseBodyHtml(body: string | null | undefined): string {
  if (!body?.trim()) {
    return "";
  }

  return escapeHtml(body.trim())
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

function buildSystemReleaseEmailHtml(params: {
  displayName: string;
  version: string;
  title: string | null;
  bodyHtml: string;
  brand: EmailBrand;
  appUrl: string;
}): string {
  const { name: brandName } = EMAIL_BRANDS[params.brand];
  const version = params.version || "—";
  const title = params.title?.trim() || "Nueva actualización disponible";

  const notes = params.bodyHtml
    ? `<p style="margin:24px 0 0 0;${SECTION_LABEL_STYLE}">Novedades</p>
       ${emailCallout(params.brand, params.bodyHtml)}`
    : "";

  return renderEmailLayout({
    brand: params.brand,
    preheader: `${title} · versión ${version}`,
    eyebrow: `Versión ${version}`,
    title,
    bodyHtml: `
      ${emailGreeting(params.displayName || "ahí")}
      ${emailParagraph(
        `Publicamos una nueva versión de <strong>${escapeHtml(brandName)}</strong> con mejoras y cambios que te pueden interesar.`,
      )}
      <div>${emailPill(params.brand, `v${version}`)}</div>
      ${notes}
      ${emailButton(params.brand, "Ver las novedades", params.appUrl)}`,
    footerNote: "Recibes este correo porque tienes una cuenta activa.",
  });
}

/**
 * Correo de novedades al crear un SystemRelease publicado.
 * Se envía un correo individual por destinatario.
 */
export async function sendSystemReleaseEmail({
  to,
  displayName,
  version,
  title,
  body,
  brand,
}: {
  to: string;
  displayName: string;
  version: string;
  title: string | null;
  body: string | null;
  brand: EmailBrand;
}): Promise<void> {
  const trimmedTo = to?.trim();
  if (!trimmedTo) {
    console.warn("sendSystemReleaseEmail: sin email destino.");
    return;
  }

  const { name: brandName, appUrl } = EMAIL_BRANDS[brand];
  const subjectTitle = title?.trim() || `Actualización v${version}`;

  await sendEmail({
    to: trimmedTo,
    subject: `Novedades en ${brandName}: ${subjectTitle}`,
    html: buildSystemReleaseEmailHtml({
      displayName,
      version,
      title,
      bodyHtml: formatReleaseBodyHtml(body),
      brand,
      appUrl: appUrl(),
    }),
    fromName: brandName,
  });
}

const PET_PLACE_APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No se presentó",
};

function appointmentStatusLabel(status: string): string {
  return PET_PLACE_APPOINTMENT_STATUS_LABELS[status] ?? status;
}

function formatAppointmentDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("es-MX", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
}

function buildPetPlaceAppointmentEmailHtml(params: {
  audience: "owner" | "customer";
  ownerName: string;
  petPlaceName: string;
  customerName: string;
  petName?: string | null;
  startsAt: string | Date;
  endsAt: string | Date;
  status: string;
}): string {
  const brand: EmailBrand = "pet";
  const isOwner = params.audience === "owner";
  const statusLabel = appointmentStatusLabel(params.status);
  const petPlaceName = escapeHtml(params.petPlaceName);
  const customerName = escapeHtml(params.customerName);
  const petName = params.petName ? escapeHtml(params.petName) : null;

  const bodyText = isOwner
    ? `<strong>${customerName}</strong> reservó una cita${petName ? ` para <strong>${petName}</strong>` : ""} en <strong>${petPlaceName}</strong>.`
    : `Tu cita en <strong>${petPlaceName}</strong> ahora está <strong>${escapeHtml(statusLabel)}</strong>.`;

  const rows: Array<[string, string]> = [
    ["Negocio", petPlaceName],
    ...(isOwner ? ([["Cliente", customerName]] as Array<[string, string]>) : []),
    ...(petName ? ([["Mascota", petName]] as Array<[string, string]>) : []),
    ["Inicio", escapeHtml(formatAppointmentDate(params.startsAt))],
    ["Fin", escapeHtml(formatAppointmentDate(params.endsAt))],
    ["Estatus", emailPill(brand, statusLabel)],
  ];

  return renderEmailLayout({
    brand,
    preheader: isOwner
      ? `${params.customerName} reservó una cita en ${params.petPlaceName}.`
      : `Tu cita en ${params.petPlaceName}: ${statusLabel}.`,
    eyebrow: isOwner ? "Agenda" : "Tu cita",
    title: isOwner ? "Nueva cita reservada" : "Actualización de tu cita",
    bodyHtml: `
      ${emailGreeting(isOwner ? params.ownerName : params.customerName)}
      ${emailParagraph(bodyText)}
      ${emailInfoTable(rows)}`,
    footerNote: "Mensaje automático de tu agenda. No respondas a este correo.",
  });
}

/**
 * Correo de agenda de PetPlace: nueva cita reservada (al dueño) o
 * cambio de estatus de una cita (al cliente).
 */
export async function sendPetPlaceAppointmentEmail({
  to,
  audience,
  ownerName,
  petPlaceName,
  customerName,
  petName,
  startsAt,
  endsAt,
  status,
}: {
  to: string;
  audience: "owner" | "customer";
  ownerName: string;
  petPlaceName: string;
  customerName: string;
  petName?: string | null;
  startsAt: string | Date;
  endsAt: string | Date;
  status: string;
}): Promise<void> {
  const trimmedTo = to?.trim();
  if (!trimmedTo) {
    console.warn("sendPetPlaceAppointmentEmail: sin email destino.");
    return;
  }

  const subject =
    audience === "owner"
      ? `Nueva cita en ${petPlaceName}`
      : `Tu cita en ${petPlaceName}: ${appointmentStatusLabel(status)}`;

  await sendEmail({
    to: trimmedTo,
    subject,
    html: buildPetPlaceAppointmentEmailHtml({
      audience,
      ownerName,
      petPlaceName,
      customerName,
      petName,
      startsAt,
      endsAt,
      status,
    }),
    fromName: EMAIL_BRANDS.pet.name,
  });
}


export type AdminBroadcastAudience = "saas" | "pet" | "all" | "custom";

type BroadcastRecipient = {
  email: string;
  displayName: string;
};

/** Texto plano → HTML seguro: párrafos, **negrita** y [texto](url). */
export function formatAdminEmailBodyHtml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const paragraphs = trimmed.split(/\n{2,}/);
  return paragraphs
    .map((paragraph) => {
      const withBreaks = escapeHtml(paragraph.trim()).replace(/\n/g, "<br>");
      const withBold = withBreaks.replace(
        /\*\*([^*]+)\*\*/g,
        "<strong>$1</strong>",
      );
      const withLinks = withBold.replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" style="color:inherit;text-decoration:underline;" target="_blank" rel="noopener noreferrer">$1</a>',
      );
      return emailParagraph(withLinks);
    })
    .join("");
}

function formatCalloutInnerHtml(raw: string): string {
  return escapeHtml(raw.trim())
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, "<br>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function buildAdminBroadcastEmailHtml(params: {
  brand: EmailBrand;
  displayName: string;
  title: string;
  eyebrow?: string | null;
  preheader?: string | null;
  body: string;
  callout?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  footerNote?: string | null;
}): string {
  const bodyHtml = formatAdminEmailBodyHtml(params.body);
  const calloutInner = params.callout?.trim()
    ? formatCalloutInnerHtml(params.callout)
    : "";

  const cta =
    params.ctaLabel?.trim() && params.ctaUrl?.trim()
      ? emailButton(params.brand, params.ctaLabel.trim(), params.ctaUrl.trim())
      : "";

  return renderEmailLayout({
    brand: params.brand,
    preheader:
      params.preheader?.trim() ||
      params.title ||
      "Mensaje de Kadesh",
    eyebrow: params.eyebrow?.trim() || undefined,
    title: params.title,
    bodyHtml: `
      ${emailGreeting(params.displayName || "ahí")}
      ${bodyHtml}
      ${calloutInner ? emailCallout(params.brand, calloutInner) : ""}
      ${cta}`,
    footerNote:
      params.footerNote?.trim() ||
      "Recibes este correo porque tienes una cuenta en Kadesh.",
  });
}

function matchesAudience(
  audience: AdminBroadcastAudience,
  hasCompany: boolean,
): boolean {
  if (audience === "saas") return hasCompany;
  if (audience === "pet") return !hasCompany;
  if (audience === "all") return true;
  return false;
}

async function resolveBroadcastRecipients(params: {
  context: import("@keystone-6/core/types").KeystoneContext;
  audience: AdminBroadcastAudience;
  emails?: string[] | null;
}): Promise<BroadcastRecipient[]> {
  const { context, audience, emails } = params;

  if (audience === "custom") {
    const list = (emails ?? [])
      .map((email) => email.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const recipients: BroadcastRecipient[] = [];

    for (const email of list) {
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const users = (await context.sudo().query.User.findMany({
        where: { email: { equals: email, mode: "insensitive" } },
        take: 1,
        query: "name lastName email",
      })) as Array<{
        name?: string | null;
        lastName?: string | null;
        email?: string | null;
      }>;

      const user = users[0];
      const displayName = user
        ? [user.name, user.lastName].filter(Boolean).join(" ").trim() || "ahí"
        : "ahí";

      recipients.push({ email, displayName });
    }

    return recipients;
  }

  const users = (await context.sudo().query.User.findMany({
    query: "id name lastName email company { id } userTest",
  })) as Array<{
    name?: string | null;
    lastName?: string | null;
    email?: string | null;
    company?: { id: string } | null;
    userTest?: boolean | null;
  }>;

  const seen = new Set<string>();
  const recipients: BroadcastRecipient[] = [];

  for (const user of users) {
    if (user.userTest === true) continue;
    const email = user.email?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;

    const hasCompany = Boolean(user.company?.id);
    if (!matchesAudience(audience, hasCompany)) continue;

    seen.add(key);
    recipients.push({
      email,
      displayName:
        [user.name, user.lastName].filter(Boolean).join(" ").trim() || "ahí",
    });
  }

  return recipients;
}

/**
 * Correo masivo o puntual desde Operaciones.
 * Usa el layout de marca (Pet / Negocios). Con dryRun solo cuenta destinatarios.
 */
export async function sendAdminBroadcastEmail(params: {
  context: import("@keystone-6/core/types").KeystoneContext;
  audience: AdminBroadcastAudience;
  brand: EmailBrand;
  emails?: string[] | null;
  subject: string;
  title: string;
  eyebrow?: string | null;
  preheader?: string | null;
  body: string;
  callout?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  footerNote?: string | null;
  dryRun?: boolean;
}): Promise<{
  recipientCount: number;
  sentCount: number;
  failedCount: number;
}> {
  const recipients = await resolveBroadcastRecipients({
    context: params.context,
    audience: params.audience,
    emails: params.emails,
  });

  if (params.dryRun || recipients.length === 0) {
    return {
      recipientCount: recipients.length,
      sentCount: 0,
      failedCount: 0,
    };
  }

  const { name: brandName } = EMAIL_BRANDS[params.brand];
  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: params.subject,
        html: buildAdminBroadcastEmailHtml({
          brand: params.brand,
          displayName: recipient.displayName,
          title: params.title,
          eyebrow: params.eyebrow,
          preheader: params.preheader,
          body: params.body,
          callout: params.callout,
          ctaLabel: params.ctaLabel,
          ctaUrl: params.ctaUrl,
          footerNote: params.footerNote,
        }),
        fromName: brandName,
      });
      sentCount++;
    } catch (err) {
      failedCount++;
      console.error(
        `[AdminBroadcast] Falló envío a ${recipient.email}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return {
    recipientCount: recipients.length,
    sentCount,
    failedCount,
  };
}
