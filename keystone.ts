import "./env";
import lists from "./models/schema";
import { config } from "@keystone-6/core";
import { withAuth, session } from "./auth/auth";

export default withAuth(
  config({
    db: {
      provider: "mysql",
      url: `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.MYSQL_DB}?connect_timeout=300`,
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
