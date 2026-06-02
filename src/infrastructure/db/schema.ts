import { pgTable, varchar, text, integer, timestamp, jsonb, customType } from "drizzle-orm/pg-core";

// Define a custom vector type for pgvector
export const pgVector = customType<{ data: number[] }>({
  dataType() {
    return "vector(3072)"; // OpenAI text-embedding-3-large dimensions
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      return value.slice(1, -1).split(",").map(Number);
    }
    return value as number[];
  }
});

export const documents = pgTable("documents", {
  id: varchar("id", { length: 256 }).primaryKey(),
  tenantId: varchar("tenant_id", { length: 256 }).notNull(),
  title: text("title").notNull(),
  sourceUri: text("source_uri"),
  mimeType: varchar("mime_type", { length: 256 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
  createdBy: varchar("created_by", { length: 256 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const documentChunks = pgTable("document_chunks", {
  id: varchar("id", { length: 256 }).primaryKey(),
  tenantId: varchar("tenant_id", { length: 256 }).notNull(),
  documentId: varchar("document_id", { length: 256 })
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  ordinal: integer("ordinal").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count").notNull(),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean>>().notNull(),
  embedding: pgVector("embedding")
});
