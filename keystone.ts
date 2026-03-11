import "./env";
import lists from "./models/schema";
import { config } from "@keystone-6/core";
import { withAuth, session } from "./auth/auth";
import extendGraphqlSchema from "./graphql/extendedSchema";

// Setup environment variables
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), "config", ".env.dev") });

/* if (
  !process.env.S3_BUCKET_NAME ||
  !process.env.S3_REGION ||
  !process.env.S3_ACCESS_KEY_ID ||
  !process.env.S3_SECRET_ACCESS_KEY
) {
  throw new Error("S3 Configs are not set");
} */

const {
  S3_BUCKET_NAME: bucketName = "",
  S3_REGION: region = "",
  S3_ACCESS_KEY_ID: accessKeyId = "",
  S3_SECRET_ACCESS_KEY: secretAccessKey = "",
} = process.env;

const hasS3 = !!(region && bucketName);

const storage: Record<string, any> = {
  my_local_images: {
    kind: "local",
    type: "image",
    generateUrl: (path: string) =>
      `http://${process.env.DB_HOST}:3000/images${path}`,
    serverRoute: { path: "/images" },
    storagePath: "public/images",
  },
  ...(hasS3
    ? {
        s3_files: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, signed: { expiry: 3600 } },
        s3_categories: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/categories/" : "categories/", signed: { expiry: 3600 } },
        s3_posts: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/posts/" : "posts/", signed: { expiry: 3600 } },
        s3_profile: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/profiles/" : "profiles/", signed: { expiry: 3600 } },
        s3_animals: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/animals/" : "animals/", signed: { expiry: 3600 } },
        s3_pets: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/pets/" : "pets/", signed: { expiry: 3600 } },
        s3_ads: { kind: "s3", type: "image", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/ads/" : "ads/", signed: { expiry: 3600 } },
        s3_tech_files: { kind: "s3", type: "file", bucketName, region, accessKeyId, secretAccessKey, pathPrefix: process.env.ENVIROMENT === "DEV" ? "dev/tech-files/" : "tech-files/", signed: { expiry: 3600 } },
      }
    : {
        s3_files: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
        s3_categories: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
        s3_posts: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
        s3_profile: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
        s3_animals: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
        s3_pets: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
        s3_ads: { kind: "local", type: "image", serverRoute: { path: "/images" }, storagePath: "public/images" },
        s3_tech_files: { kind: "local", type: "file", serverRoute: { path: "/files" }, storagePath: "public/files" },
      }),
};

export default withAuth(
  config({
    db: {
      provider: "postgresql",
      url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.POSTGRES_DB}?connect_timeout=300`,
    },
    ui:{
      isAccessAllowed: (context) => !!context.session?.data,
    },
    server: {
      cors: true,
      maxFileSize: 200 * 1024 * 1024,
      port: 3001,
    },
    storage,
    graphql: {
      extendGraphqlSchema,
    },
    lists,
    session,
  }),
);
