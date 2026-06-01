import { LlmFacade, type PromptCache, type TokenBudgetPolicy } from "../../src/infrastructure/llm/llm-facade.js";
import type { LlmProvider, LlmRequest, LlmResponse } from "../../src/infrastructure/llm/llm-provider.js";

function request(): LlmRequest {
  return {
    tenantId: "tenant-1",
    userId: "user-1",
    temperature: 0.2,
    maxOutputTokens: 100,
    timeoutMs: 1000,
    messages: [{ role: "user", content: "What is the policy?" }]
  };
}

function budgetPolicy(): TokenBudgetPolicy {
  return {
    assertWithinBudget: jest.fn().mockResolvedValue(undefined),
    recordUsage: jest.fn().mockResolvedValue(undefined)
  };
}

function nullCache(): PromptCache {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined)
  };
}

describe("LlmFacade", () => {
  it("returns cached responses without calling providers", async () => {
    const cached: LlmResponse = { content: "cached", model: "gpt", inputTokens: 1, outputTokens: 1, costUsd: 0.001 };
    const provider: LlmProvider = { name: "openai", complete: jest.fn() };
    const cache: PromptCache = { get: jest.fn().mockResolvedValue(cached), set: jest.fn() };

    const facade = new LlmFacade([provider], budgetPolicy(), cache);

    await expect(facade.completeWithFallback(request(), "cache-key")).resolves.toEqual(cached);
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it("falls back to the secondary provider when the primary fails", async () => {
    const response: LlmResponse = { content: "ok", model: "claude", inputTokens: 10, outputTokens: 20, costUsd: 0.01 };
    const primary: LlmProvider = { name: "openai", complete: jest.fn().mockRejectedValue(new Error("timeout")) };
    const secondary: LlmProvider = { name: "anthropic", complete: jest.fn().mockResolvedValue(response) };

    const facade = new LlmFacade([primary, secondary], budgetPolicy(), nullCache());

    await expect(facade.completeWithFallback(request(), "cache-key")).resolves.toEqual(response);
    expect(primary.complete).toHaveBeenCalledTimes(1);
    expect(secondary.complete).toHaveBeenCalledTimes(1);
  });
});
