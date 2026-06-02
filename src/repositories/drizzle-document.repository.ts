import { db } from "../infrastructure/db/connection.js";
import { documents, documentChunks } from "../infrastructure/db/schema.js";
import type { DocumentRepository } from "./document.repository.js";
import type { DocumentChunk, DocumentId, KnowledgeDocument, TenantId } from "../domain/documents/entities.js";
import { eq, and } from "drizzle-orm";

export class DrizzleDocumentRepository implements DocumentRepository {
  async create(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    await db.insert(documents).values({
      id: document.id,
      tenantId: document.tenantId,
      title: document.title,
      sourceUri: document.sourceUri ?? null,
      mimeType: document.mimeType,
      status: document.status,
      checksumSha256: document.checksumSha256,
      createdBy: document.createdBy,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
    return document;
  }

  async markProcessing(tenantId: TenantId, id: DocumentId): Promise<void> {
    await db
      .update(documents)
      .set({ status: "processing", updatedAt: new Date() })
      .where(and(eq(documents.tenantId, tenantId), eq(documents.id, id)));
  }

  async markIndexed(tenantId: TenantId, id: DocumentId): Promise<void> {
    await db
      .update(documents)
      .set({ status: "indexed", updatedAt: new Date() })
      .where(and(eq(documents.tenantId, tenantId), eq(documents.id, id)));
  }

  async saveChunks(chunks: DocumentChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    await db.insert(documentChunks).values(
      chunks.map((chunk) => ({
        id: chunk.id,
        tenantId: chunk.tenantId,
        documentId: chunk.documentId,
        ordinal: chunk.ordinal,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        metadata: chunk.metadata,
      }))
    );
  }

  async findById(tenantId: TenantId, id: DocumentId): Promise<KnowledgeDocument | null> {
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.id, id)))
      .limit(1);

    if (!doc) return null;

    const result: KnowledgeDocument = {
      id: doc.id,
      tenantId: doc.tenantId,
      title: doc.title,
      mimeType: doc.mimeType,
      status: doc.status as "uploaded" | "processing" | "indexed" | "failed",
      checksumSha256: doc.checksumSha256,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    if (doc.sourceUri !== null && doc.sourceUri !== undefined) {
      result.sourceUri = doc.sourceUri;
    }

    return result;
  }
}
