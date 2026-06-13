import crypto from "node:crypto";
import type { RetrievalHit } from "../../domain/documents/entities.js";
import { LlmFacade } from "../../infrastructure/llm/llm-facade.js";
import type { RetrievalHandler } from "../retrieval/retrieval-chain.js";

export interface AnswerResult {
  answer: string;
  citations: Array<{ chunkId: string; documentId: string; score: number }>;
}

export class AnswerService {
  constructor(
    private readonly retrievalChain: RetrievalHandler,
    private readonly llm: LlmFacade
  ) {}

  async answer(input: {
    tenantId: string;
    userId: string;
    question: string;
    topK: number;
  }): Promise<AnswerResult> {
    const retrieval = await this.retrievalChain.handle({
      tenantId: input.tenantId,
      question: input.question,
      topK: input.topK,
    });

    const hits = retrieval.hits ?? [];
    const context = this.formatContext(hits);

    // Cache key based on tenant + question + retrieved chunk IDs (cheaper than hashing full context)
    const chunkIds = hits.map((h) => h.chunk.id).sort().join(",");
    const cacheKey = crypto
      .createHash("sha256")
      .update(`${input.tenantId}:${input.question}:${chunkIds}`)
      .digest("hex");

    const response = await this.llm.completeWithFallback(
      {
        tenantId: input.tenantId,
        userId: input.userId,
        temperature: 0.2,
        maxOutputTokens: 900,
        timeoutMs: 30000,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that answers questions strictly from the provided knowledge base context. " +
              "Always cite the source using the chunk number [N] from the context. " +
              "If the context does not contain enough information to answer, say so clearly and list what is missing. " +
              "Do not make up information not present in the context.",
          },
          {
            role: "user",
            content: `Question: ${input.question}\n\nKnowledge Base Context:\n${context}`,
          },
        ],
      },
      cacheKey
    );

    return {
      answer: response.content,
      citations: hits.map((hit) => ({
        chunkId: hit.chunk.id,
        documentId: hit.chunk.documentId,
        score: hit.score,
      })),
    };
  }

  private formatContext(hits: RetrievalHit[]): string {
    if (hits.length === 0) {
      return "(No relevant documents found in your knowledge base.)";
    }
    return hits
      .map(
        (hit, index) =>
          `[${index + 1}] (score=${hit.score.toFixed(4)}, doc=${hit.chunk.documentId})\n${hit.chunk.content}`
      )
      .join("\n\n");
  }
}
