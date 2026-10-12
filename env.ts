const path = require("path");
const dotenv = require("dotenv");

// `KADESH_ENV=prod` carga config/.env.prod (solo para scripts de mantenimiento, nunca `keystone dev`).
const envName = process.env.KADESH_ENV || "dev";
dotenv.config({ path: path.resolve(process.cwd(), "config", `.env.${envName}`) });
