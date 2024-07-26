// Setup environment variables
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), "config", ".env.dev") });
