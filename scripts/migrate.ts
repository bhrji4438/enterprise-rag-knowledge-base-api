import { db } from "../src/infrastructure/db/connection.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import path from "node:path";

async function run() {
  console.log("Running migrations...");

  try {
    // 1. Enable pgvector extension
    console.log("Enabling pgvector extension...");
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);

    // 2. Run drizzle migrations
    const migrationsFolder = path.resolve(process.cwd(), "drizzle");
    console.log(`Applying Drizzle migrations from: ${migrationsFolder}`);
    await migrate(db, { migrationsFolder });

    console.log("Migrations applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

run();
