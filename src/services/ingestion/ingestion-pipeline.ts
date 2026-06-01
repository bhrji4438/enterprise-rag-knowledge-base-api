import type { DocumentChunk, KnowledgeDocument } from "../../domain/documents/entities.js";
import type { DocumentRepository } from "../../repositories/document.repository.js";
import type { VectorRepository } from "../../repositories/vector.repository.js";
import type { EmbeddingProvider } from "../../infrastructure/llm/llm-provider.js";

export interface IngestionContext {
  document: KnowledgeDocument;
  rawText: string;
  chunks: DocumentChunk[];
}

export interface IngestionStep {
  readonly name: string;
  execute(context: IngestionContext): Promise<IngestionContext>;
}

export class IngestionPipeline {
  constructor(private readonly steps: IngestionStep[]) {}

  async run(context: IngestionContext): Promise<IngestionContext> {
    let current = context;
    for (const step of this.steps) {
      current = await step.execute(current);
    }
    return current;
  }
}

export class PersistEmbeddingsStep implements IngestionStep {
  readonly name = "persist-embeddings";

  constructor(
    private readonly embeddings: EmbeddingProvider,
    private readonly documents: DocumentRepository,
    private readonly vectors: VectorRepository
  ) {}

  async execute(context: IngestionContext): Promise<IngestionContext> {
    const embeddings = await this.embeddings.embed(context.chunks.map((chunk) => chunk.content));
    await this.documents.saveChunks(context.chunks);
    await this.vectors.upsertEmbeddings(
      context.chunks.map((chunk, index) => ({ chunk, embedding: embeddings[index] ?? [] }))
    );
    await this.documents.markIndexed(context.document.tenantId, context.document.id);
    return context;
  }
}
