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

/** Datos del correo «tu reporte ya está publicado». Todo en texto plano: aquí se escapa. */
export type AnimalPublishedEmailInput = {
  to: string;
  displayName: string;
  /** Nombre del animal; vacío si es genérico («Sin nombre»). */
  animalName: string;
  /** Cómo nombrarlo sin nombre: «este perrito», «esta gatita». */
  unnamedWho: string;
  /** Concordancia: «lo» / «la». */
  gender: "m" | "f";
  /** `AnimalLog.status` del primer registro: lost, found, in_adoption… */
  status: string;
  statusLabel: string;
  /** Filas de la tabla de datos, sin vacías. */
  facts: ReadonlyArray<readonly [string, string]>;
  /** «Rocky · Perdido en Morelia», como el botón de compartir de la ficha. */
  shareTitle: string;
  links: {
    report: string;
    /** Tarjeta para compartir (`/animales/{slug}/og`): la foto de S3 caduca en 1 h. */
    image: string;
    addLog: string;
    edit: string;
    alerts: string;
    notificationSettings: string;
    myReports: string;
    /** Solo perdidos y encontrados. */
    promote: string | null;
  };
  /** Alertas de zona ya activas. */
  zoneAlert: { city: string; radiusKm: number | null } | null;
  whatsappOn: boolean;
};

const EMAIL_FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function emailTextLink(label: string, href: string): string {
  const { color } = EMAIL_BRANDS.pet;
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:${color};font-weight:700;text-decoration:none;">${escapeHtml(label)}&nbsp;&rarr;</a>`;
}

/** Fila numerada de «Qué puedes hacer ahora». `bodyHtml` y `linksHtml` ya escapados. */
function animalNextStepRow(
  n: number,
  title: string,
  bodyHtml: string,
  linksHtml: string,
): string {
  const { color, soft } = EMAIL_BRANDS.pet;
  return `
      <tr>
        <td valign="top" style="padding:0 14px 20px 0;width:32px;">
          <div style="width:28px;height:28px;line-height:28px;border-radius:50%;background:${soft};color:${color};font-family:${EMAIL_FONT};font-size:14px;font-weight:700;text-align:center;">${n}</div>
        </td>
        <td valign="top" style="padding:3px 0 20px 0;font-family:${EMAIL_FONT};">
          <p style="margin:0 0 4px 0;font-size:16px;font-weight:700;line-height:1.4;color:${EMAIL_TEXT.heading};">${escapeHtml(title)}</p>
          <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:${EMAIL_TEXT.body};">${bodyHtml}</p>
          <p style="margin:0;font-size:15px;line-height:1.8;">${linksHtml}</p>
        </td>
      </tr>`;
}

function animalPublishedCopy(input: AnimalPublishedEmailInput): {
  subject: string;
  preheader: string;
  intro: string;
  closing: string;
} {
  const named = input.animalName.trim();
  const whoHtml = `<strong>${escapeHtml(named || input.unnamedWho)}</strong>`;
  const lo = input.gender === "f" ? "la" : "lo";

  switch (input.status) {
    case "lost":
      return {
        subject: named ? `Publicamos el reporte de ${named}` : "Publicamos tu reporte",
        preheader: "Ya aparece en el mapa de su zona. Esto es lo que puedes hacer para que llegue a más gente.",
        intro: `Ya publicamos el reporte de ${whoHtml}. Aparece en el mapa de la zona y avisamos a quienes tienen alertas cerca. Mientras más gente ${lo} vea, más fácil es que vuelva a casa.`,
        closing: "Si alguien reporta un animal parecido cerca, te avisamos como posible coincidencia.",
      };
    case "found":
      return {
        subject: named ? `Publicamos el reporte de ${named}` : "Publicamos tu reporte",
        preheader: "Ya aparece en el mapa de su zona. Esto es lo que puedes hacer para que llegue a su familia.",
        intro: `Ya publicamos el reporte de ${whoHtml}. Aparece en el mapa de la zona y avisamos a quienes tienen alertas cerca, para que su familia ${lo} encuentre. Gracias por ayudar.`,
        closing:
          "Si alguien dice que es su mascota, te llega una solicitud para que la revises. Si alguien perdió un animal parecido cerca, te avisamos como posible coincidencia.",
      };
    case "in_adoption":
      return {
        subject: named ? `${named} ya está en adopción en KADESH` : "Tu publicación de adopción ya está en KADESH",
        preheader: "Ya está publicado. Esto es lo que puedes hacer para que encuentre un hogar.",
        intro: `Ya publicamos a ${whoHtml} en adopción. Quien quiera darle un hogar puede verlo en KADESH y mandarte una solicitud.`,
        closing: "Las solicitudes de adopción te llegan a la campana de avisos y las revisas en la ficha.",
      };
    case "rescued":
    case "abandoned":
      return {
        subject: named ? `Tu reporte de ${named} ya está publicado` : "Tu reporte ya está publicado",
        preheader: "Ya está en KADESH. Esto es lo que puedes hacer ahora.",
        intro: `Ya publicamos el reporte de ${whoHtml}. Gracias por ayudar: así más gente puede echar una mano.`,
        closing: "Si alguien dice que es su mascota, te llega una solicitud para que la revises.",
      };
    default:
      return {
        subject: named ? `Tu reporte de ${named} ya está publicado` : "Tu reporte ya está publicado",
        preheader: "Ya está en KADESH. Esto es lo que puedes hacer ahora.",
        intro: `Ya publicamos el reporte de ${whoHtml}.`,
        closing: "Los comentarios sobre tu reporte te llegan a la campana de avisos.",
      };
  }
}

export function buildAnimalPublishedEmailHtml(input: AnimalPublishedEmailInput): string {
  const brand: EmailBrand = "pet";
  const { color } = EMAIL_BRANDS[brand];
  const { links } = input;
  const copy = animalPublishedCopy(input);
  const who = input.animalName.trim() || input.unnamedWho;
  const isAdoption = input.status === "in_adoption";

  const rows: [string, string][] = [
    ["Estado", emailPill(brand, input.statusLabel)],
    ...input.facts.map(([label, value]) => [label, escapeHtml(value)] as [string, string]),
  ];

  const shareText = `Ayuda a difundir este reporte en KADESH: ${input.shareTitle}\n${links.report}`;
  const whatsappShare = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const facebookShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(links.report)}`;

  const zone = input.zoneAlert;
  const zoneBody = zone
    ? `Ya tienes alertas de zona${zone.city ? ` en <strong>${escapeHtml(zone.city)}</strong>` : ""}${
        zone.radiusKm ? ` (${zone.radiusKm} km)` : ""
      }. Puedes cambiar la zona o el radio cuando quieras.`
    : "Elige una zona y te avisamos cuando reporten una mascota perdida o encontrada ahí.";

  // Solo los avisos que existen para este estado (plantillas de WhatsApp de kadesh-back):
  // coincidencias en perdidos y encontrados; solicitudes «es mi mascota» en los de la calle.
  const whatsappTopics =
    input.status === "lost"
      ? "comentarios y posibles coincidencias de tu reporte"
      : input.status === "found"
        ? "comentarios, posibles coincidencias y solicitudes de quien diga que es su mascota"
        : input.status === "rescued" || input.status === "abandoned"
          ? "comentarios y solicitudes de quien diga que es su mascota"
          : "comentarios de tu publicación";
  const whatsappBody = input.whatsappOn
    ? `Ya los tienes activados: te llegan por WhatsApp los ${whatsappTopics}.`
    : `Actívalos para enterarte al momento de ${whatsappTopics}. Solo te llegan si tú los activas.`;

  const steps = [
    animalNextStepRow(
      1,
      "Compártelo",
      `Mándalo a tus grupos de vecinos, de mascotas y a tus contactos. Este es su enlace:<br><a href="${escapeHtml(links.report)}" target="_blank" rel="noopener noreferrer" style="color:${color};word-break:break-all;">${escapeHtml(links.report)}</a>`,
      `${emailTextLink("Compartir por WhatsApp", whatsappShare)}<br>${emailTextLink("Compartir en Facebook", facebookShare)}`,
    ),
    animalNextStepRow(
      2,
      "Cuéntanos lo nuevo",
      isAdoption
        ? "Si ya encontró hogar o cambió algo, agrega un registro a su historial. Así quien sigue la publicación ve siempre lo último."
        : "Cada vez que sepas algo (lo vieron en otro lugar, cambió su estado o ya está en casa), agrega un registro a su historial. Así quien sigue el reporte ve siempre lo último.",
      emailTextLink("Agregar un registro", links.addLog),
    ),
    animalNextStepRow(
      3,
      "Mantén sus datos al día",
      "Puedes cambiar las fotos, las señas y los teléfonos de contacto cuando quieras.",
      emailTextLink("Editar reporte", links.edit),
    ),
    animalNextStepRow(
      4,
      "Alertas de zona",
      zoneBody,
      emailTextLink(zone ? "Ver mis alertas" : "Activar alertas de zona", links.alerts),
    ),
    animalNextStepRow(
      5,
      "Avisos por WhatsApp",
      whatsappBody,
      emailTextLink(input.whatsappOn ? "Ajustes de avisos" : "Activar avisos por WhatsApp", links.notificationSettings),
    ),
  ].join("");

  const promote = links.promote
    ? emailCallout(
        brand,
        `<strong style="color:${EMAIL_TEXT.heading};">¿Quieres que ${input.gender === "f" ? "la" : "lo"} vea más gente de la zona?</strong><br>
        Los reportes se comparten gratis en la página de Facebook de KADESH. Si quieres llegar a más personas cerca, puedes pagar un anuncio: es opcional, lo que pagas va completo a Meta (KADESH no cobra nada) y te mandamos los comprobantes.<br>
        <span style="display:inline-block;margin-top:10px;">${emailTextLink("Impulsar en Facebook", links.promote)}</span><br>
        <span style="display:inline-block;margin-top:10px;font-size:13px;color:${EMAIL_TEXT.muted};">KADESH nunca te escribe primero para pedirte dinero y solo atiende por su WhatsApp oficial.</span>`,
      )
    : "";

  return renderEmailLayout({
    brand,
    preheader: copy.preheader,
    eyebrow: "Reporte publicado",
    title: copy.subject,
    bodyHtml: `
      ${emailGreeting(input.displayName || "ahí")}
      ${emailParagraph(copy.intro)}
      <a href="${escapeHtml(links.report)}" target="_blank" rel="noopener noreferrer" style="display:block;margin:24px 0 0 0;text-decoration:none;">
        <img src="${escapeHtml(links.image)}" width="528" alt="${escapeHtml(`Reporte de ${who}`)}" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:12px;background:${EMAIL_TEXT.surface};">
      </a>
      ${emailInfoTable(rows)}
      ${emailButton(brand, "Ver reporte", links.report)}
      <p style="margin:36px 0 16px 0;${SECTION_LABEL_STYLE}">Qué puedes hacer ahora</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${steps}</table>
      ${promote}
      <p style="margin:28px 0 0 0;font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;color:${EMAIL_TEXT.body};">${escapeHtml(copy.closing)}</p>
      <p style="margin:16px 0 0 0;font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;">${emailTextLink("Ver todos tus reportes", links.myReports)}</p>`,
    footerNote: "Recibiste este correo porque publicaste un reporte en Kadesh Pet.",
  });
}

/** Al dueño de un reporte cuando ya quedó completo (primer registro y fotos). */
export async function sendAnimalPublishedEmail(input: AnimalPublishedEmailInput): Promise<void> {
  const trimmedTo = input.to?.trim();
  if (!trimmedTo) {
    console.warn("sendAnimalPublishedEmail: sin email destino.");
    return;
  }

  await sendEmail({
    to: trimmedTo,
    subject: animalPublishedCopy(input).subject,
    html: buildAnimalPublishedEmailHtml(input),
    fromName: EMAIL_BRANDS.pet.name,
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


/** Recordatorio de la cartilla (vacuna, desparasitación…) a un dueño de la mascota. */
export async function sendPetReminderEmail({
  to,
  displayName,
  petName,
  title,
  dateLabel,
  dueLabel,
  url,
}: {
  to: string;
  displayName: string;
  petName: string;
  title: string;
  /** "12 de noviembre" */
  dateLabel: string;
  /** "vence hoy", "vence el 12 de noviembre", "venció el …" */
  dueLabel: string;
  /** Cartilla de la mascota en la web. */
  url: string;
}): Promise<void> {
  const trimmedTo = to?.trim();
  if (!trimmedTo) {
    console.warn("sendPetReminderEmail: sin email destino.");
    return;
  }

  const html = renderEmailLayout({
    brand: "pet",
    preheader: `${title} de ${petName}: ${dueLabel}.`,
    eyebrow: "Cartilla",
    title: `Recordatorio de ${petName}`,
    bodyHtml: `
      ${emailGreeting(displayName)}
      ${emailParagraph(
        `Te recordamos que <strong>${escapeHtml(title)}</strong> de <strong>${escapeHtml(petName)}</strong> ${escapeHtml(dueLabel)}.`,
      )}
      ${emailInfoTable([
        ["Mascota", escapeHtml(petName)],
        ["Recordatorio", escapeHtml(title)],
        ["Fecha", escapeHtml(dateLabel)],
      ])}
      ${emailButton("pet", "Ver cartilla", url)}`,
    footerNote: `Recibiste este correo porque la cartilla de ${petName} tiene recordatorios por correo.`,
  });

  await sendEmail({
    to: trimmedTo,
    subject: `Recordatorio: ${title} de ${petName}`,
    html,
    fromName: EMAIL_BRANDS.pet.name,
  });
}

/**
 * A quien el dueño principal registró como familiar de una mascota: ya tiene cuenta y la
 * contraseña la eligió ese familiar. Nunca lleva la contraseña.
 */
export async function sendPetFamilyAccountEmail({
  to,
  displayName,
  inviterName,
  petName,
  url,
}: {
  to: string;
  displayName: string;
  inviterName: string;
  petName: string;
  /** Cartilla de la mascota en la web (pide iniciar sesión). */
  url: string;
}): Promise<void> {
  const trimmedTo = to?.trim();
  if (!trimmedTo) {
    console.warn("sendPetFamilyAccountEmail: sin email destino.");
    return;
  }

  const html = renderEmailLayout({
    brand: "pet",
    preheader: `${inviterName} te agregó a la cartilla de ${petName}.`,
    eyebrow: "Cartilla",
    title: `Te agregaron a la cartilla de ${petName}`,
    bodyHtml: `
      ${emailGreeting(displayName)}
      ${emailParagraph(
        `<strong>${escapeHtml(inviterName)}</strong> te creó una cuenta en Kadesh Pet y te agregó a la cartilla de <strong>${escapeHtml(petName)}</strong>. Podrás ver sus vacunas y registros, y te llegarán sus recordatorios.`,
      )}
      ${emailCallout(
        "pet",
        `Para entrar usa este correo (<strong>${escapeHtml(trimmedTo)}</strong>). Tu contraseña la eligió ${escapeHtml(inviterName)}: pídesela.`,
      )}
      ${emailButton("pet", "Ver cartilla", url)}`,
    footerNote: `Recibiste este correo porque ${inviterName} te registró en Kadesh Pet.`,
  });

  await sendEmail({
    to: trimmedTo,
    subject: `${inviterName} te agregó a la cartilla de ${petName}`,
    html,
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

/**
 * Aviso de seguridad a los admins (fase 6.5): alguien se pasó de un límite contra abuso.
 * Solo sale si `ADMIN_NOTIFICATION_EMAILS=on` (lo revisa quien llama); siempre llega a la campana.
 */
export async function sendAdminSecurityAlertEmail({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}): Promise<void> {
  const recipients = parseAdminNotificationEmails();
  if (recipients.length === 0) return;
  const brand: EmailBrand = "saas";
  await sendEmail({
    to: recipients,
    subject: `[Kadesh] Alerta de seguridad: ${title}`,
    html: renderEmailLayout({
      brand,
      preheader: title,
      eyebrow: "Alerta de seguridad",
      title,
      bodyHtml: `
        ${emailParagraph(
          "Revisa Operaciones → Seguridad. Desde ahí puedes ver todo lo que pasó desde esa IP y bloquearla.",
        )}
        ${emailInfoTable(rows.map(([label, value]) => [escapeHtml(label), escapeHtml(value)]))}`,
      footerNote: "Mensaje automático. No respondas a este correo.",
    }),
    fromName: EMAIL_BRANDS[brand].name,
  });
}
