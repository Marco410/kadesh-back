import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cliente S3 propio para guardar media de WhatsApp (no pasa por los campos `image`/`file` de
 * Keystone: esos están pensados para subidas que llegan directo en un `createOne` de la list;
 * aquí el binario sale de la Media API de Meta o de un `Upload` en una mutación custom).
 * Mismas env vars que ya usa `keystone.ts` para el resto del storage (misma cuenta R2).
 */
function getClient(): S3Client {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  return new S3Client({
    region: process.env.S3_REGION?.trim() || "auto",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim() || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim() || "",
    },
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });
}

function getBucketName(): string {
  const bucket = process.env.S3_BUCKET_NAME?.trim();
  if (!bucket) throw new Error("[storage] Falta S3_BUCKET_NAME");
  return bucket;
}

export async function uploadBufferToStorage({
  buffer,
  contentType,
  key,
}: {
  buffer: Buffer;
  contentType: string;
  key: string;
}): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

/** URL firmada de lectura, igual criterio que el resto del bucket (privado, 1h de vigencia). */
export async function getSignedStorageUrl({
  key,
  expirySeconds = 3600,
}: {
  key: string;
  expirySeconds?: number;
}): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: getBucketName(), Key: key });
  return getSignedUrl(client, command, { expiresIn: expirySeconds });
}
