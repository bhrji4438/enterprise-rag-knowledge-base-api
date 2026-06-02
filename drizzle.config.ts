import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

let databaseUrl = "postgres://rag:rag@localhost:5432/rag_kb";

try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf-8");
    const match = envFile.match(/^DATABASE_URL=(.+)$/m);
    if (match && match[1]) {
      databaseUrl = match[1].trim();
    }
  }
} catch (e) {
  // Ignore
}

if (databaseUrl.includes("@postgres:")) {
  databaseUrl = databaseUrl.replace("@postgres:", "@localhost:");
}

export default defineConfig({
  schema: "./src/infrastructure/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
