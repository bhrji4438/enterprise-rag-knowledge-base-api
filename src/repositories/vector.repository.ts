import type { DocumentChunk, RetrievalHit, TenantId } from "../domain/documents/entities.js";

export interface VectorRepository {
  upsertEmbeddings(input: Array<{ chunk: DocumentChunk; embedding: number[] }>): Promise<void>;
  search(input: { tenantId: TenantId; embedding: number[]; topK: number; filters?: Record<string, unknown> }): Promise<RetrievalHit[]>;
}
