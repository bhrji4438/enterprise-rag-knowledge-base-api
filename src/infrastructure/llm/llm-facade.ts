import { ProblemDetailsError } from "../../shared/errors/problem-details.js";
import type { LlmProvider, LlmRequest, LlmResponse } from "./llm-provider.js";

export interface TokenBudgetPolicy {
  assertWithinBudget(input: { tenantId: string; estimatedTokens: number }): Promise<void>;
  recordUsage(input: { tenantId: string; model: string; inputTokens: number; outputTokens: number; costUsd: number }): Promise<void>;
}

export interface PromptCache {
  get(key: string): Promise<LlmResponse | null>;
  set(key: string, value: LlmResponse, ttlSeconds: number): Promise<void>;
}

export class LlmFacade {
  constructor(
    private readonly providers: LlmProvider[],
    private readonly budgetPolicy: TokenBudgetPolicy,
    private readonly cache: PromptCache
  ) {}

  async completeWithFallback(request: LlmRequest, cacheKey: string): Promise<LlmResponse> {
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    await this.budgetPolicy.assertWithinBudget({
      tenantId: request.tenantId,
      estimatedTokens: request.maxOutputTokens + request.messages.reduce((sum, item) => sum + item.content.length / 4, 0)
    });

    const failures: string[] = [];
    for (const provider of this.providers) {
      try {
        const response = await provider.complete(request);
        await this.budgetPolicy.recordUsage({ tenantId: request.tenantId, ...response });
        await this.cache.set(cacheKey, response, 300);
        return response;
      } catch (error) {
        failures.push(`${provider.name}: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }

    throw new ProblemDetailsError({
      status: 503,
      title: "LLM providers unavailable",
      type: "https://ragkb.dev/problems/llm-unavailable",
      detail: failures.join("; ")
    });
  }
}
