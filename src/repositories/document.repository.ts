import type { DocumentChunk, DocumentId, KnowledgeDocument, TenantId } from "../domain/documents/entities.js";

export interface DocumentRepository {
  create(document: KnowledgeDocument): Promise<KnowledgeDocument>;
  markProcessing(tenantId: TenantId, id: DocumentId): Promise<void>;
  markIndexed(tenantId: TenantId, id: DocumentId): Promise<void>;
  saveChunks(chunks: DocumentChunk[]): Promise<void>;
  findById(tenantId: TenantId, id: DocumentId): Promise<KnowledgeDocument | null>;
}
