import type { VectorRepository } from "../../../repositories/vector.repository.js";
import { BaseRetrievalHandler } from "../retrieval-chain.js";
import type { RetrievalRequest } from "../retrieval-chain.js";
import { ProblemDetailsError } from "../../../shared/errors/problem-details.js";

/**
 * VectorSearchHandler — second link in the retrieval chain.
 * Requires `request.embedding` to be populated by EmbeddingRetrievalHandler.
 * Executes tenant-scoped similarity search and attaches hits to the request.
 */
export class VectorSearchHandler extends BaseRetrievalHandler {
  constructor(private readonly vectorRepo: VectorRepository) {
    super();
  }

  protected async process(request: RetrievalRequest): Promise<RetrievalRequest> {
    if (!request.embedding || request.embedding.length === 0) {
      throw new ProblemDetailsError({
        status: 500,
        title: "Retrieval error",
        type: "https://ragkb.dev/problems/retrieval-error",
        detail: "VectorSearchHandler requires an embedding — did you add EmbeddingRetrievalHandler to the chain?",
      });
    }

    const hits = await this.vectorRepo.search({
      tenantId: request.tenantId,
      embedding: request.embedding,
      topK: request.topK,
      ...(request.filters !== undefined && { filters: request.filters }),
    });

    return { ...request, hits };
  }
}
