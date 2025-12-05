// Setup environment variables
const path = require("path");
const dotenv = require("dotenv");


if (process.env.NODE_ENV !== "production") {
    dotenv.config({ path: path.resolve(process.cwd(), "config", ".env.dev") });
  }
