import { db } from "../infrastructure/db/connection.js";
import { documentChunks } from "../infrastructure/db/schema.js";
import type { VectorRepository } from "./vector.repository.js";
import type { DocumentChunk, RetrievalHit, TenantId } from "../domain/documents/entities.js";
import { eq, and, sql } from "drizzle-orm";

export class DrizzleVectorRepository implements VectorRepository {
  async upsertEmbeddings(input: Array<{ chunk: DocumentChunk; embedding: number[] }>): Promise<void> {
    await db.transaction(async (tx) => {
      for (const item of input) {
        await tx
          .update(documentChunks)
          .set({ embedding: item.embedding })
          .where(
            and(
              eq(documentChunks.id, item.chunk.id),
              eq(documentChunks.tenantId, item.chunk.tenantId)
            )
          );
      }
    });
  }

  async search(input: {
    tenantId: TenantId;
    embedding: number[];
    topK: number;
    filters?: Record<string, unknown>;
  }): Promise<RetrievalHit[]> {
    const embeddingStr = `[${input.embedding.join(",")}]`;

    const similarity = sql<number>`1 - (${documentChunks.embedding} <=> ${embeddingStr}::vector)`;

    const conditions = [
      eq(documentChunks.tenantId, input.tenantId),
      sql`${documentChunks.embedding} IS NOT NULL`
    ];

    if (input.filters) {
      for (const [key, value] of Object.entries(input.filters)) {
        if (value !== undefined && value !== null) {
          conditions.push(sql`${documentChunks.metadata}->>${key} = ${String(value)}`);
        }
      }
    }

    const results = await db
      .select({
        id: documentChunks.id,
        tenantId: documentChunks.tenantId,
        documentId: documentChunks.documentId,
        ordinal: documentChunks.ordinal,
        content: documentChunks.content,
        tokenCount: documentChunks.tokenCount,
        metadata: documentChunks.metadata,
        score: similarity,
      })
      .from(documentChunks)
      .where(and(...conditions))
      .orderBy(sql`${documentChunks.embedding} <=> ${embeddingStr}::vector`)
      .limit(input.topK);

    return results.map((row) => ({
      chunk: {
        id: row.id,
        tenantId: row.tenantId,
        documentId: row.documentId,
        ordinal: row.ordinal,
        content: row.content,
        tokenCount: row.tokenCount,
        metadata: row.metadata,
      },
      score: Number(row.score),
    }));
  }
}
