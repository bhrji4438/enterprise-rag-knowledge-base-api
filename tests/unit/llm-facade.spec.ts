import assert from "node:assert/strict";
import { LlmFacade, type PromptCache, type TokenBudgetPolicy } from "../../src/infrastructure/llm/llm-facade.js";
import type { LlmProvider, LlmRequest, LlmResponse } from "../../src/infrastructure/llm/llm-provider.js";

function asyncMock<TArgs extends unknown[], TResult>(result: TResult, reject = false) {
  const calls: TArgs[] = [];
  const fn = async (...args: TArgs): Promise<TResult> => {
    calls.push(args);
    if (reject) throw result;
    return result;
  };
  return Object.assign(fn, { calls });
}

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
    assertWithinBudget: asyncMock<[{ tenantId: string; estimatedTokens: number }], void>(undefined),
    recordUsage: asyncMock<[Record<string, unknown>], void>(undefined)
  };
}

function nullCache(): PromptCache {
  return {
    get: asyncMock<[string], LlmResponse | null>(null),
    set: asyncMock<[string, LlmResponse, number], void>(undefined)
  };
}

export async function testCachedResponsesSkipProviders(): Promise<void> {
  const cached: LlmResponse = { content: "cached", model: "gpt", inputTokens: 1, outputTokens: 1, costUsd: 0.001 };
  const complete = asyncMock<[LlmRequest], LlmResponse>(cached);
  const provider: LlmProvider = { name: "openai", complete };
  const cache: PromptCache = {
    get: asyncMock<[string], LlmResponse | null>(cached),
    set: asyncMock<[string, LlmResponse, number], void>(undefined)
  };

  const facade = new LlmFacade([provider], budgetPolicy(), cache);

  assert.deepEqual(await facade.completeWithFallback(request(), "cache-key"), cached);
  assert.equal(complete.calls.length, 0);
}

export async function testFallbackToSecondaryProvider(): Promise<void> {
  const response: LlmResponse = { content: "ok", model: "claude", inputTokens: 10, outputTokens: 20, costUsd: 0.01 };
  const primaryComplete = asyncMock<[LlmRequest], Error>(new Error("timeout"), true);
  const secondaryComplete = asyncMock<[LlmRequest], LlmResponse>(response);
  const primary: LlmProvider = { name: "openai", complete: primaryComplete as unknown as LlmProvider["complete"] };
  const secondary: LlmProvider = { name: "anthropic", complete: secondaryComplete };

  const facade = new LlmFacade([primary, secondary], budgetPolicy(), nullCache());

  assert.deepEqual(await facade.completeWithFallback(request(), "cache-key"), response);
  assert.equal(primaryComplete.calls.length, 1);
  assert.equal(secondaryComplete.calls.length, 1);
}
