# C. AI/LLM Integration Spec

## 1. LLM Provider Strategy

Primary: OpenAI for embeddings and chat through the official OpenAI SDK, wrapped by internal provider interfaces. Fallback: Anthropic for answer synthesis when OpenAI times out or returns provider errors. LangChain.js or LlamaIndex can be added later as optional orchestration adapters, but they are intentionally not installed in the current package set to keep `npm ci` warning-free and provider contracts stable. Model selection uses request intent: cheap summarization uses a small model, high-confidence Q&A uses the configured primary, and JSON extraction uses models with reliable structured output.

## 2. Prompt Engineering

System prompt: answer only from retrieved context, cite chunk IDs, refuse unsupported claims, and expose missing evidence. User template includes question, tenant-safe context, conversation summary, and required JSON shape when applicable. Output schemas are enforced with Zod and retried once with validation errors included as corrective feedback.

## 3. Context Window Management

Documents are chunked at 600-800 tokens with 100-120 token overlap. Retrieval defaults to top 8 chunks, then reranks and trims by token budget. Conversation memory stores rolling summaries plus the last few turns; raw history is not blindly injected.

## 4. Async LLM Pipeline

Ingestion and answer generation use BullMQ. Streaming answers are delivered over SSE while the worker writes tokens to Redis pub/sub. Every provider call has timeout, retry with jitter, and circuit-breaker metadata.

## 5. Cost Control Architecture

`llm_usage` records provider, model, tokens, and cost. Redis caches identical prompt/context hashes. Tenant budgets are enforced before calls and reconciled after calls. Admins can configure hard stops or soft warning thresholds.

## 6. LLM Output Validation

Structured answers use JSON schema validation. Freeform answers must include citations mapped to retrieved chunk IDs. Hallucination mitigation includes context-only instructions, source coverage checks, and retry on missing citations.

## 7. Observability

Each LLM call logs provider, model, latency, timeout status, token usage, cost, tenant ID, and correlation ID. Metrics include provider error rate, p95 latency, cache hit rate, tokens per tenant, and queue lag.

## 8. Privacy & Compliance

PII redaction runs before embeddings and prompts when enabled. Audit logs record user, tenant, action, model, and resource IDs, not raw secrets. Data retention policies allow deleting documents, chunks, vectors, prompts, and usage details by tenant.

## 9. Complete Provider-Agnostic LLM Service

```ts
import crypto from "node:crypto";
import { z } from "zod";

export interface LlmProvider {
  name: string;
  complete(input: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    temperature: number;
    maxOutputTokens: number;
    timeoutMs: number;
  }): Promise<{ content: string; model: string; inputTokens: number; outputTokens: number; costUsd: number }>;
}

const AnswerSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(z.object({ chunkId: z.string(), quote: z.string().max(500) })),
  confidence: z.enum(["low", "medium", "high"])
});

export class EnterpriseLlmService {
  constructor(
    private readonly providers: LlmProvider[],
    private readonly cache: { get(key: string): Promise<string | null>; set(key: string, value: string, ttl: number): Promise<void> },
    private readonly usage: { assertBudget(tenantId: string, estimated: number): Promise<void>; record(event: unknown): Promise<void> }
  ) {}

  async answer(input: { tenantId: string; userId: string; question: string; context: string }) {
    const cacheKey = crypto.createHash("sha256").update(`${input.tenantId}:${input.question}:${input.context}`).digest("hex");
    const cached = await this.cache.get(cacheKey);
    if (cached) return AnswerSchema.parse(JSON.parse(cached));

    await this.usage.assertBudget(input.tenantId, Math.ceil((input.question.length + input.context.length) / 4) + 900);

    const messages = [
      { role: "system" as const, content: "Return strict JSON. Answer only from context. Include citations by chunkId." },
      { role: "user" as const, content: `Question:\n${input.question}\n\nContext:\n${input.context}` }
    ];

    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        const startedAt = Date.now();
        const raw = await provider.complete({ messages, temperature: 0.1, maxOutputTokens: 900, timeoutMs: 30000 });
        const parsed = AnswerSchema.parse(JSON.parse(raw.content));
        await this.usage.record({ tenantId: input.tenantId, userId: input.userId, provider: provider.name, latencyMs: Date.now() - startedAt, ...raw });
        await this.cache.set(cacheKey, JSON.stringify(parsed), 300);
        return parsed;
      } catch (error) {
        errors.push(`${provider.name}: ${error instanceof Error ? error.message : "unknown"}`);
      }
    }
    throw new Error(`LLM answer failed after fallback chain: ${errors.join("; ")}`);
  }
}
```
