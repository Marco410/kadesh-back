import type { KeystoneContext } from "@keystone-6/core/types";

const ANONYMIZED_LABEL = "persona anonimizada";

export type AnonymizableUser = {
  id: string;
  name: string | null;
  lastName: string | null;
  secondLastName?: string | null;
  email: string | null;
  companyId?: string | null;
};

/**
 * Borra los datos personales de una cuenta y la deja inservible (ARCO / "borrar mi cuenta"):
 * nombre, correo, teléfono, foto, datos bancarios, contraseña, zona de alertas y tokens push.
 * Sus reportes, comentarios y citas quedan, firmados como "Usuario eliminado". Sube
 * `sessionVersion`, así que sus sesiones abiertas dejan de valer. Escribe con Prisma (sin hooks).
 * Quien llama valida permisos y registra la actividad.
 */
export async function anonymizeUserData(context: KeystoneContext, user: AnonymizableUser): Promise<void> {
  const userId = user.id;
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  const short = userId.slice(-8);
  const name = [user.name, user.lastName, user.secondLastName].filter(Boolean).join(" ").trim();
  const mentions = [name, [user.name, user.lastName].filter(Boolean).join(" ").trim(), user.email]
    .filter((text): text is string => Boolean(text && text.length >= 4));

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Usuario",
        lastName: "eliminado",
        secondLastName: null,
        username: `eliminado-${short}`,
        referralCode: `eliminado-${short}`,
        email: `eliminado+${userId}@kadesh.invalid`,
        businessEmail: null,
        businessPhone: null,
        phone: "",
        birthday: null,
        bank: "",
        clabe: null,
        cardNumber: null,
        smsRegistrationId: "",
        profileImage_id: null,
        profileImage_extension: null,
        profileImage_filesize: null,
        profileImage_width: null,
        profileImage_height: null,
        password: null,
        verified: false,
        onboardingState: {},
        anonymizedAt: new Date(),
        // Zona de alertas de Pet: es una ubicación personal.
        petAlertsEnabled: false,
        alertLat: null,
        alertLng: null,
        sessionVersion: { increment: 1 },
        company: { disconnect: true },
        roles: { set: [] },
        workspaces: { set: [] },
      },
    }),
    prisma.userAuthLog.updateMany({
      where: { userId },
      data: { ip: null, userAgent: null, emailMasked: "***" },
    }),
    prisma.activityEvent.updateMany({
      where: { actorId: userId },
      data: { ip: null, userAgent: null },
    }),
    prisma.blogSubscription.deleteMany({
      where: { OR: [{ userId }, ...(user.email ? [{ email: user.email }] : [])] },
    }),
    prisma.tokenNotification.deleteMany({ where: { userId } }),
    prisma.techWhatsAppMessage.updateMany({
      where: { sentById: userId },
      data: { senderLabel: ANONYMIZED_LABEL },
    }),
    // Menciones en el texto de otros eventos ("Asignó el lead a …", "Cambió los roles de …"),
    // solo en eventos de su empresa o sobre ella. strpos y no LIKE: un "_" del correo es comodín.
    ...mentions.map(
      (mention) => prisma.$executeRaw`
        UPDATE "ActivityEvent"
        SET "summary" = replace("summary", ${mention}, ${ANONYMIZED_LABEL})
        WHERE strpos("summary", ${mention}) > 0
          AND ("company" = ${user.companyId ?? null} OR "actor" = ${userId} OR "entityId" = ${userId})
      `,
    ),
    // En la metadata no se reemplaza a medias (podría romper el JSON): se limpia completa.
    ...mentions.map(
      (mention) => prisma.$executeRaw`
        UPDATE "ActivityEvent"
        SET "metadata" = '{"anonymized": true}'::jsonb
        WHERE strpos("metadata"::text, ${mention}) > 0
          AND ("company" = ${user.companyId ?? null} OR "actor" = ${userId} OR "entityId" = ${userId})
      `,
    ),
  ]);
}
