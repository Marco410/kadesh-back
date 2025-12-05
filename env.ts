// Setup environment variables
import * as path from "path";
import * as dotenv from "dotenv";
import * as fs from "fs";

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
}
