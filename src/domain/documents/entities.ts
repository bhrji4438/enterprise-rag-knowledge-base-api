export type TenantId = string;
export type UserId = string;
export type DocumentId = string;

export interface KnowledgeDocument {
  id: DocumentId;
  tenantId: TenantId;
  title: string;
  sourceUri?: string;
  mimeType: string;
  status: "uploaded" | "processing" | "indexed" | "failed";
  checksumSha256: string;
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk {
  id: string;
  tenantId: TenantId;
  documentId: DocumentId;
  ordinal: number;
  content: string;
  tokenCount: number;
  metadata: Record<string, string | number | boolean>;
}

export interface RetrievalHit {
  chunk: DocumentChunk;
  score: number;
}
