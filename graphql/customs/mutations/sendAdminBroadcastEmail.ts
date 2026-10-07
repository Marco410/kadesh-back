import { KeystoneContext } from "@keystone-6/core/types";
import { hasRole } from "../../../auth/permissions";
import { Role } from "../../../models/Role/constants";
import {
  sendAdminBroadcastEmail,
  type AdminBroadcastAudience,
  type EmailBrand,
} from "../../../utils/helpers/sendgrid";
import { isSmtpConfigured } from "../../../utils/intregrations/smtpMail";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CUSTOM_RECIPIENTS = 200;
const MAX_SUBJECT = 200;
const MAX_TITLE = 160;
const MAX_BODY = 12_000;
const MAX_SHORT = 200;

const AUDIENCES = new Set<AdminBroadcastAudience>([
  "saas",
  "pet",
  "all",
  "custom",
]);
const BRANDS = new Set<EmailBrand>(["saas", "pet"]);

const typeDefs = `
  enum AdminEmailAudience {
    saas
    pet
    all
    custom
  }

  enum AdminEmailBrand {
    saas
    pet
  }

  input SendAdminBroadcastEmailInput {
    audience: AdminEmailAudience!
    brand: AdminEmailBrand!
    emails: [String!]
    subject: String!
    title: String!
    eyebrow: String
    preheader: String
    body: String!
    callout: String
    ctaLabel: String
    ctaUrl: String
    footerNote: String
    dryRun: Boolean
  }

  type SendAdminBroadcastEmailResult {
    success: Boolean!
    message: String!
    recipientCount: Int!
    sentCount: Int!
    failedCount: Int!
    dryRun: Boolean!
    brand: String!
    audience: String!
  }

  type Mutation {
    sendAdminBroadcastEmail(input: SendAdminBroadcastEmailInput!): SendAdminBroadcastEmailResult!
  }
`;

const definition = `
  sendAdminBroadcastEmail(input: SendAdminBroadcastEmailInput!): SendAdminBroadcastEmailResult!
`;

type Input = {
  audience: string;
  brand: string;
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
  dryRun?: boolean | null;
};

function fail(
  message: string,
  partial?: Partial<{
    recipientCount: number;
    sentCount: number;
    failedCount: number;
    dryRun: boolean;
    brand: string;
    audience: string;
  }>,
) {
  return {
    success: false,
    message,
    recipientCount: partial?.recipientCount ?? 0,
    sentCount: partial?.sentCount ?? 0,
    failedCount: partial?.failedCount ?? 0,
    dryRun: partial?.dryRun ?? false,
    brand: partial?.brand ?? "",
    audience: partial?.audience ?? "",
  };
}

function trimOrEmpty(value: string | null | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}

function parseCustomEmails(raw: string[] | null | undefined): {
  emails: string[];
  error: string | null;
} {
  const list = (raw ?? [])
    .map((email) => email.trim())
    .filter(Boolean);

  if (list.length === 0) {
    return {
      emails: [],
      error: "Agrega al menos un correo para el envío a usuarios específicos.",
    };
  }

  if (list.length > MAX_CUSTOM_RECIPIENTS) {
    return {
      emails: [],
      error: `Máximo ${MAX_CUSTOM_RECIPIENTS} correos por envío a usuarios específicos.`,
    };
  }

  const seen = new Set<string>();
  const emails: string[] = [];

  for (const email of list) {
    if (!EMAIL_REGEX.test(email)) {
      return { emails: [], error: `Correo inválido: ${email}` };
    }
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }

  return { emails, error: null };
}

const resolver = {
  sendAdminBroadcastEmail: async (
    _root: unknown,
    { input }: { input: Input },
    context: KeystoneContext,
  ) => {
    if (!hasRole(context.session, [Role.ADMIN])) {
      return fail("Solo administradores de plataforma pueden enviar correos.");
    }

    const audience = input.audience as AdminBroadcastAudience;
    const brand = input.brand as EmailBrand;
    const dryRun = input.dryRun === true;

    if (!AUDIENCES.has(audience)) {
      return fail("Audiencia no válida.");
    }
    if (!BRANDS.has(brand)) {
      return fail("Marca no válida.");
    }

    const subject = trimOrEmpty(input.subject, MAX_SUBJECT);
    const title = trimOrEmpty(input.title, MAX_TITLE);
    const body = trimOrEmpty(input.body, MAX_BODY);
    const eyebrow = trimOrEmpty(input.eyebrow, MAX_SHORT) || null;
    const preheader = trimOrEmpty(input.preheader, MAX_SHORT) || null;
    const callout = trimOrEmpty(input.callout, MAX_BODY) || null;
    const ctaLabel = trimOrEmpty(input.ctaLabel, 80) || null;
    const ctaUrl = trimOrEmpty(input.ctaUrl, 500) || null;
    const footerNote = trimOrEmpty(input.footerNote, 400) || null;

    if (!subject) return fail("El asunto es obligatorio.", { brand, audience, dryRun });
    if (!title) return fail("El título es obligatorio.", { brand, audience, dryRun });
    if (!body) return fail("El cuerpo del correo es obligatorio.", { brand, audience, dryRun });

    if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl)) {
      return fail(
        "El botón necesita etiqueta y enlace, o déjalos ambos vacíos.",
        { brand, audience, dryRun },
      );
    }

    if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) {
      return fail("El enlace del botón debe empezar con http:// o https://.", {
        brand,
        audience,
        dryRun,
      });
    }

    let customEmails: string[] | undefined;
    if (audience === "custom") {
      const parsed = parseCustomEmails(input.emails);
      if (parsed.error) {
        return fail(parsed.error, { brand, audience, dryRun });
      }
      customEmails = parsed.emails;
    }

    if (!dryRun && !isSmtpConfigured()) {
      return fail(
        "El correo no está configurado. Revisa MAILTRAP_API_TOKEN (o SMTP_PASS) y SMTP_FROM.",
        { brand, audience, dryRun },
      );
    }

    try {
      const result = await sendAdminBroadcastEmail({
        context,
        audience,
        brand,
        emails: customEmails,
        subject,
        title,
        eyebrow,
        preheader,
        body,
        callout,
        ctaLabel,
        ctaUrl,
        footerNote,
        dryRun,
      });

      if (result.recipientCount === 0) {
        return fail(
          audience === "custom"
            ? "No hay correos válidos para enviar."
            : "No hay destinatarios con correo en esa audiencia.",
          { brand, audience, dryRun, recipientCount: 0 },
        );
      }

      if (dryRun) {
        return {
          success: true,
          message: `Listos ${result.recipientCount} destinatarios. Nada se envió (solo conteo).`,
          recipientCount: result.recipientCount,
          sentCount: 0,
          failedCount: 0,
          dryRun: true,
          brand,
          audience,
        };
      }

      const ok = result.failedCount === 0;
      return {
        success: ok,
        message: ok
          ? `Enviado a ${result.sentCount} destinatarios.`
          : `Enviado a ${result.sentCount}; fallaron ${result.failedCount}.`,
        recipientCount: result.recipientCount,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        dryRun: false,
        brand,
        audience,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo completar el envío.";
      return fail(message, { brand, audience, dryRun });
    }
  },
};

export default { typeDefs, definition, resolver };
