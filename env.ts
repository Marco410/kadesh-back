/* // Setup environment variables
import path from "path";
import dotenv from "dotenv";
import fs from "fs";

// Determinar qué archivo .env cargar
const envFile = process.env.NODE_ENV === "production" 
  ? path.resolve(process.cwd(), "config", ".env.prod")
  : path.resolve(process.cwd(), "config", ".env.dev");

// Verificar si el archivo existe antes de cargarlo
if (fs.existsSync(envFile)) {
  const result = dotenv.config({ path: envFile });
  if (result.error) {
    console.warn(`Warning: Error loading .env file from ${envFile}:`, result.error);
  } else {
    console.log(`✓ Loaded environment variables from ${envFile}`);
  }
} else {
  console.warn(`Warning: .env file not found at ${envFile}`);
  // Intentar cargar .env.dev como fallback
  const fallbackFile = path.resolve(process.cwd(), "config", ".env.dev");
  if (fs.existsSync(fallbackFile)) {
    dotenv.config({ path: fallbackFile });
    console.log(`✓ Loaded environment variables from fallback: ${fallbackFile}`);
  }
} */


import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Cargar .env.dev solo en desarrollo
if (process.env.NODE_ENV !== "production") {
  const devEnv = path.resolve(process.cwd(), "config", ".env.dev");
  if (fs.existsSync(devEnv)) {
    dotenv.config({ path: devEnv });
    console.log("✓ Loaded .env.dev");
  } else {
    console.log("⚠️ .env.dev not found, using system environment variables");
  }
} else {
  console.log("✓ Production mode — NOT loading .env.dev (Railway variables stay intact)");
}