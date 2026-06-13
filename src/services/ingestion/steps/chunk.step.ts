import crypto from "node:crypto";
import type { DocumentChunk } from "../../../domain/documents/entities.js";
import type { IngestionContext, IngestionStep } from "../ingestion-pipeline.js";

/**
 * ChunkStep — splits rawText into overlapping DocumentChunks.
 *
 * Strategy:
 *  - Target size:  maxTokens (1 token ≈ 4 chars, approximate)
 *  - Overlap:      overlapTokens (repeated at start of next chunk for context continuity)
 *  - Boundary:     prefer sentence endings (". ", "! ", "? ") to avoid mid-sentence splits
 *
 * TODO: Replace the char/4 approximation with tiktoken for accurate token counts.
 */
export class ChunkStep implements IngestionStep {
  readonly name = "chunk";

  private readonly maxChars: number;
  private readonly overlapChars: number;

  constructor(maxTokens: number, overlapTokens: number) {
    this.maxChars = maxTokens * 4;
    this.overlapChars = overlapTokens * 4;
  }

  async execute(context: IngestionContext): Promise<IngestionContext> {
    if (!context.rawText) {
      throw new Error(`[ChunkStep] rawText is empty for document ${context.document.id}`);
    }

    const chunks = this.split(context.rawText, context.document);
    return { ...context, chunks };
  }

  private split(text: string, document: { id: string; tenantId: string }): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let start = 0;
    let ordinal = 0;

    while (start < text.length) {
      const end = Math.min(start + this.maxChars, text.length);
      let breakAt = end;

      // Try to break at a sentence boundary within the last 20% of the chunk
      if (end < text.length) {
        const searchStart = Math.floor(start + this.maxChars * 0.8);
        const searchRegion = text.slice(searchStart, end);
        const sentenceMatch = [...searchRegion.matchAll(/[.!?]\s/g)].pop();
        if (sentenceMatch?.index !== undefined) {
          breakAt = searchStart + sentenceMatch.index + 2; // include punctuation
        }
      }

      const content = text.slice(start, breakAt).trim();
      if (content.length > 0) {
        chunks.push({
          id: crypto.randomUUID(),
          tenantId: document.tenantId,
          documentId: document.id,
          ordinal,
          content,
          // Approximate token count (replace with tiktoken for production accuracy)
          tokenCount: Math.ceil(content.length / 4),
          metadata: { ordinal, chunkStart: start, chunkEnd: breakAt },
        });
        ordinal++;
      }

      // Move forward with overlap so adjacent chunks share context
      start = breakAt - this.overlapChars;
      if (start <= 0 || start >= text.length) break;
    }

    return chunks;
  }
}
