-- Migration 0001: Performance indexes and data integrity constraints
-- Run after 0000_thin_imperial_guard.sql

-- ── Tenant isolation indexes (critical for multi-tenant query correctness) ──
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id
  ON documents(tenant_id);

CREATE INDEX IF NOT EXISTS idx_documents_status
  ON documents(status);

CREATE INDEX IF NOT EXISTS idx_document_chunks_tenant_id
  ON document_chunks(tenant_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
  ON document_chunks(document_id);

-- ── Deduplication: prevent same file uploaded twice per tenant ───────────────
ALTER TABLE documents
  ADD CONSTRAINT IF NOT EXISTS uq_documents_tenant_checksum
  UNIQUE (tenant_id, checksum_sha256);

-- ── HNSW vector index for fast approximate KNN similarity search ─────────────
-- ef_construction=64 balances build speed vs recall quality for initial load.
-- Tune m and ef_construction upward once data volume and recall requirements are known.
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── GIN index for metadata JSONB filtering ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_document_chunks_metadata_gin
  ON document_chunks
  USING gin(metadata);
