import { KeystoneContext } from "@keystone-6/core/types";
import { sendSystemReleaseEmail } from "../../utils/helpers/sendgrid";
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
  product: SystemReleaseProduct,
  appUrl: string,
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
        product,
        appUrl,
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
      "[SystemRelease] SMTP no configurado. No se envían correos de release.",
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

  const appUrl =
    process.env.FRONTEND_URL?.trim() ||
    "https://kadesh.com.mx/auth/login";

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      await sendReleaseEmailWithTimeout(recipient, release, product, appUrl);
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

export const systemReleaseEmailHook = {
  afterOperation: async ({ operation, item, context }: any) => {
    if (operation !== "create" || !item?.id) {
      return;
    }

    if (item.isPublished !== true) {
      return;
    }

    void (async () => {
      try {
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
