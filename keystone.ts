import "./env";
import lists from "./models/schema";
import { config } from "@keystone-6/core";
import { withAuth, session } from "./auth/auth";

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
    },

    lists,
    session,
  })
);
