/**
 * Genera un signed_request de Meta para probar el callback de eliminación en local.
 *
 *   pnpm meta:sign-request
 *   pnpm meta:sign-request 218471
 *
 * Lee META_APP_SECRET de config/.env.dev (o del entorno). El user id es el argumento
 * o "218471" si no pasas uno. No llama a Meta.
 */
import "../env";
import { signMetaRequest } from "../webhooks/metaDataDeletion";

const secret = process.env.META_APP_SECRET?.trim();
if (!secret) {
  console.error("Falta META_APP_SECRET en config/.env.dev");
  process.exit(1);
}

const userId = process.argv[2]?.trim() || "218471";
const signedRequest = signMetaRequest(secret, userId);
const port = process.env.LOCAL_PORT?.trim() || "3001";

console.log(signedRequest);
console.log("");
console.log(`curl -s -X POST http://localhost:${port}/webhooks/meta/data-deletion \\`);
console.log(`  -H 'Content-Type: application/x-www-form-urlencoded' \\`);
console.log(`  --data-urlencode 'signed_request=${signedRequest}'`);
