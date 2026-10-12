import { KeystoneContext } from "@keystone-6/core/types";
import {
  emailBrandForUser,
  sendSystemReleaseEmail,
  type EmailBrand,
} from "../../utils/helpers/sendgrid";
import { isSmtpConfigured } from "../../utils/intregrations/smtpMail";
import {
  SYSTEM_RELEASE_PRODUCT,
  type SystemReleaseProduct,
} from "./constants";

type ReleaseItem = {
  id: string;
  version?: string | null;
  product?: SystemReleaseProduct | null;
  title?: string | null;
  body?: string | null;
  isPublished?: boolean | null;
};

type UserRecipient = {
  email: string;
  displayName: string;
  brand: EmailBrand;
};

function buildDisplayName(user: {
  name?: string | null;
  lastName?: string | null;
}): string {
  return [user.name, user.lastName].filter(Boolean).join(" ").trim() || "ahí";
}

function matchesProduct(
  product: SystemReleaseProduct,
  hasCompany: boolean,
): boolean {
  if (product === SYSTEM_RELEASE_PRODUCT.SAAS) return hasCompany;
  if (product === SYSTEM_RELEASE_PRODUCT.PET) return !hasCompany;
  return true;
}

async function getReleaseRecipients(
  context: KeystoneContext,
  product: SystemReleaseProduct,
): Promise<UserRecipient[]> {
  const users = await context.sudo().query.User.findMany({
    query: "id name lastName email company { id } userTest",
  });

  const seen = new Set<string>();
  const recipients: UserRecipient[] = [];

  for (const user of users as {
    name?: string | null;
    lastName?: string | null;
    email?: string | null;
    company?: { id: string } | null;
    userTest?: boolean | null;
  }[]) {
    if (user.userTest === true) continue;

    const email = user.email?.trim();
    if (!email || seen.has(email.toLowerCase())) continue;

    const hasCompany = Boolean(user.company?.id);
    if (!matchesProduct(product, hasCompany)) continue;

    seen.add(email.toLowerCase());
    recipients.push({
      email,
      displayName: buildDisplayName(user),
      brand: emailBrandForUser(hasCompany),
    });
  }

  return recipients;
}

function isPublishedRelease(release: ReleaseItem | null | undefined): boolean {
  return release?.isPublished === true;
}

const EMAIL_SEND_TIMEOUT_MS = 30_000;

function formatSendError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

async function sendReleaseEmailWithTimeout(
  recipient: UserRecipient,
  release: ReleaseItem,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Timeout (${EMAIL_SEND_TIMEOUT_MS}ms) al enviar a ${recipient.email}`,
        ),
      );
    }, EMAIL_SEND_TIMEOUT_MS);
  });

  try {
    await Promise.race([
      sendSystemReleaseEmail({
        to: recipient.email,
        displayName: recipient.displayName,
        version: release.version ?? "",
        title: release.title ?? null,
        body: release.body ?? null,
        brand: recipient.brand,
      }),
      timeout,
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function notifyUsersForRelease(
  context: KeystoneContext,
  release: ReleaseItem,
): Promise<void> {
  if (!isPublishedRelease(release)) {
    return;
  }

  if (!isSmtpConfigured()) {
    console.warn(
      "[SystemRelease] Mailtrap no configurado. No se envían correos de release.",
    );
    return;
  }

  const product =
    (release.product as SystemReleaseProduct | undefined) ??
    SYSTEM_RELEASE_PRODUCT.ALL;

  const recipients = await getReleaseRecipients(context, product);
  if (recipients.length === 0) {
    console.log("[SystemRelease] Sin destinatarios con email válido.");
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      await sendReleaseEmailWithTimeout(recipient, release);
      sent++;
    } catch (err) {
      failed++;
      console.error(
        `[SystemRelease] No se pudo enviar release a ${recipient.email}: ${formatSendError(err)}`,
      );
    }
  }

  console.log(
    `[SystemRelease] Release ${release.version ?? release.id}: ${sent} enviados, ${failed} fallidos, ${recipients.length} destinatarios.`,
  );
}

/**
 * Correo de novedades: se manda cuando la novedad pasa a publicada (al crearla publicada o al
 * publicar un borrador), si `notifyByEmail` está activo, y una sola vez: `emailedAt` se marca antes
 * de enviar con una actualización condicional, así dos guardados seguidos no mandan dos correos.
 * Antes solo se mandaba al crearla ya publicada; un borrador publicado después nunca avisaba.
 */
export const systemReleaseEmailHook = {
  afterOperation: async ({ operation, item, originalItem, context }: any) => {
    if ((operation !== "create" && operation !== "update") || !item?.id) return;
    if (item.isPublished !== true || item.notifyByEmail === false || item.emailedAt) return;
    // Solo al pasar a publicada: editar una que ya estaba publicada nunca manda correo (las de antes
    // de este cambio no tienen `emailedAt` y no deben volver a mandarse).
    if (operation === "update" && originalItem?.isPublished === true) return;

    void (async () => {
      try {
        const prisma = context.sudo().prisma as any;
        const claim = await prisma.systemRelease.updateMany({
          where: { id: item.id, emailedAt: null, isPublished: true },
          data: { emailedAt: new Date() },
        });
        if (claim instanceof Error || !claim?.count) return;

        const release = (await context.sudo().query.SystemRelease.findOne({
          where: { id: item.id },
          query: "id version product title body isPublished",
        })) as ReleaseItem | null;

        if (!release || !isPublishedRelease(release)) {
          return;
        }

        await notifyUsersForRelease(context, release);
      } catch (error) {
        console.error(
          "[SystemRelease] Error en hook de correo:",
          formatSendError(error),
        );
      }
    })();
  },
};
