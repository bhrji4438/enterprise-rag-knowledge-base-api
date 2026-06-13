import type { EmbeddingProvider } from "../../../infrastructure/llm/llm-provider.js";
import { BaseRetrievalHandler } from "../retrieval-chain.js";
import type { RetrievalRequest } from "../retrieval-chain.js";

/**
 * EmbeddingRetrievalHandler — first link in the retrieval chain.
 * Embeds the user question and attaches the vector to the request
 * so that downstream handlers can perform similarity search.
 */
export class EmbeddingRetrievalHandler extends BaseRetrievalHandler {
  constructor(private readonly embeddings: EmbeddingProvider) {
    super();
  }

  protected async process(request: RetrievalRequest): Promise<RetrievalRequest> {
    const [embedding] = await this.embeddings.embed([request.question]);
    if (!embedding) {
      throw new Error("[EmbeddingRetrievalHandler] embedding provider returned empty result");
    }
    return { ...request, embedding };
  }
}
