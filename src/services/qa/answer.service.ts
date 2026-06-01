import crypto from "node:crypto";
import type { RetrievalHit } from "../../domain/documents/entities.js";
import { LlmFacade } from "../../infrastructure/llm/llm-facade.js";
import type { RetrievalHandler } from "../retrieval/retrieval-chain.js";

export class AnswerService {
  constructor(
    private readonly retrievalChain: RetrievalHandler,
    private readonly llm: LlmFacade
  ) {}

  async answer(input: { tenantId: string; userId: string; question: string; topK: number }): Promise<string> {
    const retrieval = await this.retrievalChain.handle({
      tenantId: input.tenantId,
      question: input.question,
      topK: input.topK
    });

    const context = this.formatContext(retrieval.hits ?? []);
    const cacheKey = crypto
      .createHash("sha256")
      .update(`${input.tenantId}:${input.question}:${context}`)
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
              "Answer only from the supplied knowledge base context. If evidence is insufficient, say so and list the missing facts."
          },
          { role: "user", content: `Question: ${input.question}\n\nContext:\n${context}` }
        ]
      },
      cacheKey
    );

    return response.content;
  }

  private formatContext(hits: RetrievalHit[]): string {
    return hits
      .map((hit, index) => `[${index + 1}] score=${hit.score.toFixed(4)} document=${hit.chunk.documentId}\n${hit.chunk.content}`)
      .join("\n\n");
  }
}
