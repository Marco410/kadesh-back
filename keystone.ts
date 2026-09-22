import "./env";
import lists from "./models/schema";
import { config } from "@keystone-6/core";
import { withAuth, session } from "./auth/auth";
import extendGraphqlSchema from "./graphql/extendedSchema";
import { isPlatformAdmin } from "./utils/access/tenant";
import registerWhatsAppWebhook from "./webhooks/whatsapp";

// Setup environment variables
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), "config", ".env.dev") });

const {
  S3_BUCKET_NAME: bucketName = "",
  S3_REGION: region = "auto",
  S3_ACCESS_KEY_ID: accessKeyId = "",
  S3_SECRET_ACCESS_KEY: secretAccessKey = "",
  S3_ENDPOINT: endpoint = "",
} = process.env;

const hasObjectStorage = !!(bucketName && accessKeyId && secretAccessKey);
const useDevPrefix = (process.env.ENVIROMENT ?? "").toUpperCase() === "DEV";
const prefix = (prod: string) => (useDevPrefix ? `dev/${prod}` : prod);

const s3Common = {
  kind: "s3" as const,
  bucketName,
  region: region || "auto",
  accessKeyId,
  secretAccessKey,
  ...(endpoint
    ? { endpoint, forcePathStyle: true }
    : {}),
  signed: { expiry: 3600 } as const,
};

const storage: Record<string, any> = {
  my_local_images: {
    kind: "local",
    type: "image",
    generateUrl: (path: string) =>
      `http://${process.env.DB_HOST}:3000/images${path}`,
    serverRoute: { path: "/images" },
    storagePath: "public/images",
  },
  ...(hasObjectStorage
    ? {
        s3_files: {
          ...s3Common,
          type: "image",
        },
        s3_categories: {
          ...s3Common,
          type: "image",
          pathPrefix: prefix("categories/"),
        },
        s3_posts: {
          ...s3Common,
          type: "image",
          pathPrefix: prefix("posts/"),
        },
        s3_profile: {
          ...s3Common,
          type: "image",
          pathPrefix: prefix("profiles/"),
        },
        s3_animals: {
          ...s3Common,
          type: "image",
          pathPrefix: prefix("animals/"),
        },
        s3_pets: {
          ...s3Common,
          type: "image",
          pathPrefix: prefix("pets/"),
        },
        s3_ads: {
          ...s3Common,
          type: "image",
          pathPrefix: prefix("ads/"),
        },
        s3_tech_files: {
          ...s3Common,
          type: "file",
          pathPrefix: prefix("tech-files/"),
        },
        s3_company_logo: {
          ...s3Common,
          type: "file",
          pathPrefix: prefix("company-logo/"),
        },
      }
    : {
        s3_files: {
          kind: "local",
          type: "image",
          serverRoute: { path: "/images" },
          storagePath: "public/images",
        },
        s3_categories: {
          kind: "local",
          type: "image",
          serverRoute: { path: "/images" },
          storagePath: "public/images",
        },
        s3_posts: {
          kind: "local",
          type: "image",
          serverRoute: { path: "/images" },
          storagePath: "public/images",
        },
        s3_profile: {
          kind: "local",
          type: "image",
          serverRoute: { path: "/images" },
          storagePath: "public/images",
        },
        s3_animals: {
          kind: "local",
          type: "image",
          serverRoute: { path: "/images" },
          storagePath: "public/images",
        },
        s3_pets: {
          kind: "local",
          type: "image",
          serverRoute: { path: "/images" },
          storagePath: "public/images",
        },
        s3_ads: {
          kind: "local",
          type: "image",
          serverRoute: { path: "/images" },
          storagePath: "public/images",
        },
        s3_tech_files: {
          kind: "local",
          type: "file",
          serverRoute: { path: "/files" },
          storagePath: "public/files",
        },
        s3_company_logo: {
          kind: "local",
          type: "file",
          serverRoute: { path: "/images" },
          storagePath: "public/images",
        },
      }),
};

export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connect_timeout=300`,
      prismaClientPath: "node_modules/.prisma/client",
    },
    ui: {
      isAccessAllowed: (context) => isPlatformAdmin(context.session),
    },
    server: {
      cors: true,
      maxFileSize: 200 * 1024 * 1024,
      port: Number(process.env.LOCAL_PORT) || 3001,
      extendExpressApp: (app, context) => {
        registerWhatsAppWebhook(app, context);
      },
    },
    storage,
    graphql: {
      extendGraphqlSchema,
      // Default de body-parser es 100kb — insuficiente para el .txt de historial de WhatsApp
      // mandado como variable de la mutación importWhatsAppChatExport.
      bodyParser: { limit: "15mb" },
    },
    lists,
    session,
  }),
);
