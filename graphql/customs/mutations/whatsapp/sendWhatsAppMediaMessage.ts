import crypto from "crypto";
import type { Readable } from "stream";
import { KeystoneContext } from "@keystone-6/core/types";
import { decrypt } from "../../../../utils/helpers/encryption";
import {
  sendWhatsAppMediaMessage as sendMediaToWhatsApp,
  uploadMediaToWhatsApp,
} from "../../../../utils/intregrations/whatsapp";
import { uploadBufferToStorage } from "../../../../utils/intregrations/s3Storage";
import { getSessionCompanyId } from "../../../../utils/access/tenant";
import { canUseCompanyWhatsapp, denyCompanyWhatsappUseMessage } from "./access";

const typeDefs = `
  type SendWhatsAppMediaMessageResult {
    success: Boolean!
    message: String!
    messageId: String
  }

  type Mutation {
    sendWhatsAppMediaMessage(businessLeadId: ID!, media: Upload!, caption: String): SendWhatsAppMediaMessageResult!
  }
`;

const definition = `
  sendWhatsAppMediaMessage(businessLeadId: ID!, media: Upload!, caption: String): SendWhatsAppMediaMessageResult!
`;

type UploadValue = {
  filename: string;
  mimetype: string;
  createReadStream: () => Readable;
};

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function toResult(success: boolean, message: string, messageId: string | null = null) {
  return { success, message, messageId };
}

const resolver = {
  sendWhatsAppMediaMessage: async (
    _root: unknown,
    {
      businessLeadId,
      media,
      caption,
    }: { businessLeadId: string; media: Promise<UploadValue>; caption?: string | null },
    context: KeystoneContext,
  ) => {
    const session = context.session;
    const companyId = getSessionCompanyId(session);

    const lead = await context.sudo().query.TechBusinessLead.findOne({
      where: { id: businessLeadId },
      query: "id phone saasCompany { id }",
    });
    if (!lead) return toResult(false, "No se encontró el lead");

    const leadCompanyIds: string[] = (lead.saasCompany ?? []).map((c: any) => c.id);
    const effectiveCompanyId =
      companyId && leadCompanyIds.includes(companyId) ? companyId : null;

    if (!effectiveCompanyId || !canUseCompanyWhatsapp(session, effectiveCompanyId)) {
      return toResult(false, denyCompanyWhatsappUseMessage(session));
    }

    const toDigits = lead.phone ? lead.phone.replace(/\D/g, "") : null;
    if (!toDigits) return toResult(false, "Este lead no tiene un teléfono válido");
    const to = toDigits.length === 10 ? `52${toDigits}` : toDigits;

    const company = await context.sudo().query.SaasCompany.findOne({
      where: { id: effectiveCompanyId },
      query: "id whatsappPhoneNumberId whatsappAccessTokenEncrypted",
    });
    if (!company?.whatsappPhoneNumberId || !company?.whatsappAccessTokenEncrypted) {
      return toResult(false, "WhatsApp no está conectado para esta empresa");
    }

    const { filename, mimetype, createReadStream } = await media;
    const buffer = await streamToBuffer(createReadStream());
    const mediaType: "image" | "document" = mimetype.startsWith("image/") ? "image" : "document";
    const mediaKey = `whatsapp-media/${effectiveCompanyId}/${crypto.randomUUID()}-${filename}`;

    try {
      const accessToken = decrypt(company.whatsappAccessTokenEncrypted);

      const uploaded = await uploadMediaToWhatsApp({
        phoneNumberId: company.whatsappPhoneNumberId,
        accessToken,
        buffer,
        mimetype,
        filename,
      });

      const sent = await sendMediaToWhatsApp({
        phoneNumberId: company.whatsappPhoneNumberId,
        accessToken,
        to,
        mediaId: uploaded.id,
        type: mediaType,
        filename: mediaType === "document" ? filename : undefined,
        caption: caption || undefined,
      });

      // Copia permanente en R2 — best-effort, no debe tumbar el envío si falla.
      try {
        await uploadBufferToStorage({ buffer, contentType: mimetype, key: mediaKey });
      } catch (storageErr) {
        console.error("[whatsapp] No se pudo guardar copia del media en R2:", storageErr);
      }

      await context.sudo().query.TechWhatsAppMessage.createOne({
        data: {
          company: { connect: { id: effectiveCompanyId } },
          businessLead: { connect: { id: businessLeadId } },
          direction: "outbound",
          toPhone: to,
          body: caption || "",
          mediaKey,
          mediaType,
          mediaFileName: filename,
          status: "sent",
          sentBy: session?.data?.id ? { connect: { id: session.data.id } } : undefined,
        },
      });

      return toResult(true, "Enviado", sent.id);
    } catch (err) {
      await context.sudo().query.TechWhatsAppMessage.createOne({
        data: {
          company: { connect: { id: effectiveCompanyId } },
          businessLead: { connect: { id: businessLeadId } },
          direction: "outbound",
          toPhone: to,
          body: caption || "",
          mediaType,
          mediaFileName: filename,
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Error desconocido",
          sentBy: session?.data?.id ? { connect: { id: session.data.id } } : undefined,
        },
      });
      return toResult(false, err instanceof Error ? err.message : "No se pudo enviar el archivo");
    }
  },
};

export default { typeDefs, definition, resolver };
