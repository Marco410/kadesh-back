import "./env";
import lists from "./models/schema";
import { config } from "@keystone-6/core";
import { withAuth, session } from "./auth/auth";
import extendGraphqlSchema from "./graphql/extendedSchema";

// Debug: Verificar variables S3
console.log("=== S3 Environment Variables Debug ===");
console.log("S3_BUCKET_NAME:", process.env.S3_BUCKET_NAME ? "✓ Set" : "✗ Missing");
console.log("S3_REGION:", process.env.S3_REGION ? "✓ Set" : "✗ Missing");
console.log("S3_ACCESS_KEY_ID:", process.env.S3_ACCESS_KEY_ID ? "✓ Set" : "✗ Missing");
console.log("S3_SECRET_ACCESS_KEY:", process.env.S3_SECRET_ACCESS_KEY ? "✓ Set" : "✗ Missing");
console.log("NODE_ENV:", process.env.NODE_ENV || "not set");
console.log("======================================");


if (
  !process.env.S3_BUCKET_NAME ||
  !process.env.S3_REGION ||
  !process.env.S3_ACCESS_KEY_ID ||
  !process.env.S3_SECRET_ACCESS_KEY
) {
  console.error("\n❌ S3 Configuration Error:");
  console.error("Missing S3 environment variables:");
  if (!process.env.S3_BUCKET_NAME) console.error("  - S3_BUCKET_NAME");
  if (!process.env.S3_REGION) console.error("  - S3_REGION");
  if (!process.env.S3_ACCESS_KEY_ID) console.error("  - S3_ACCESS_KEY_ID");
  if (!process.env.S3_SECRET_ACCESS_KEY) console.error("  - S3_SECRET_ACCESS_KEY");
  console.error("\nPlease check your .env file in the config/ directory");
  throw new Error("S3 Configs are not set");
}

const {
  S3_BUCKET_NAME: bucketName = "",
  S3_REGION: region = "",
  S3_ACCESS_KEY_ID: accessKeyId = "",
  S3_SECRET_ACCESS_KEY: secretAccessKey = "",
} = process.env;


export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connect_timeout=300`,
    },
    server: {
      cors: true,
      maxFileSize: 200 * 1024 * 1024,
      healthCheck: true,
    },
    storage: {
      my_local_images: {
        kind: "local",
        type: "image",
        generateUrl: (path) =>
          `http://${process.env.DB_HOST}:3000/images${path}`,
        serverRoute: {
          path: "/images",
        },
        storagePath: "public/images",
      },
      s3_files: {
        kind: "s3", // this storage uses S3
        type: "image", // only for files
        bucketName, // from your S3_BUCKET_NAME environment variable
        region, // from your S3_REGION environment variable
        accessKeyId, // from your S3_ACCESS_KEY_ID environment variable
        secretAccessKey, // from your S3_SECRET_ACCESS_KEY environment variable
        signed: { expiry: 3600 }, // (optional) links will be signed with an expiry of 3600 seconds (an hour)
      },
      s3_categories: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        pathPrefix: "categories/", // subcarpeta para categorías
        signed: { expiry: 3600 },
      },
      s3_posts: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        pathPrefix: "posts/", // subcarpeta para posts
        signed: { expiry: 3600 },
      },
      s3_profile: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        pathPrefix: "profiles/", // subcarpeta para posts
        signed: { expiry: 3600 },
      },
    },
    lists,
    session,
    extendGraphqlSchema,
  })
);
