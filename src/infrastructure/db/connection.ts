import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { loadConfig } from "../../config/env.js";
import * as schema from "./schema.js";
import fs from "node:fs";

const config = loadConfig();

let databaseUrl = config.DATABASE_URL;

// If running outside Docker, rewrite container db host to localhost
const isInDocker = fs.existsSync("/.dockerenv");
if (!isInDocker && databaseUrl.includes("@postgres:")) {
  databaseUrl = databaseUrl.replace("@postgres:", "@localhost:");
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
});

export const db = drizzle(pool, { schema });
