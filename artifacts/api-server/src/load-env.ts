import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

// Render injects DATABASE_URL itself. This also makes the API service's .env
// file work during local development.
if (!process.env.DATABASE_URL) {
  const envFile = fileURLToPath(new URL("../.env", import.meta.url));
  if (existsSync(envFile)) loadEnvFile(envFile);
}
