# B. Design Patterns Implementation Guide

## Pipeline - Enterprise Integration Pattern

Used for document ingestion where each stage has one job: parse, sanitize, chunk, embed, persist. It appears in `src/services/ingestion/ingestion-pipeline.ts` as `IngestionPipeline`, `IngestionStep`, and `PersistEmbeddingsStep`.

```ts
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
```

It improves testability because each step can be unit tested with a fake context and no external services.

## Chain of Responsibility - GoF Behavioral

Used in retrieval where query normalization, embedding, vector search, reranking, and policy filtering can vary independently. It appears in `src/services/retrieval/retrieval-chain.ts` as `BaseRetrievalHandler`.

```ts
export abstract class BaseRetrievalHandler implements RetrievalHandler {
  private next?: RetrievalHandler;

  setNext(handler: RetrievalHandler): RetrievalHandler {
    this.next = handler;
    return handler;
  }

  async handle(request: RetrievalRequest): Promise<RetrievalRequest> {
    const result = await this.process(request);
    return this.next ? this.next.handle(result) : result;
  }

  protected abstract process(request: RetrievalRequest): Promise<RetrievalRequest>;
}
```

It lets the system add reranking or tenant policy filtering without rewriting the retrieval flow.

## Strategy - GoF Behavioral

Used for LLM, embedding, and vector providers. The same service can run OpenAI plus pgvector locally or OpenAI plus Pinecone in production. It appears in `src/infrastructure/llm/llm-provider.ts` as `LlmProvider` and `EmbeddingProvider`.

```ts
export interface LlmProvider {
  readonly name: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}

export class ProviderRouter {
  constructor(private readonly providers: LlmProvider[]) {}

  select(intent: "cheap" | "accurate"): LlmProvider[] {
    return intent === "cheap"
      ? this.providers.filter((provider) => provider.name.includes("openai"))
      : this.providers;
  }
}
```

This mirrors Mohit's Chargezoom gateway abstraction: one internal contract, multiple external implementations.

## Facade - GoF Structural

Used to hide provider fallback, usage accounting, cache lookup, and budget enforcement behind one API. It appears in `src/infrastructure/llm/llm-facade.ts` as `LlmFacade`.

```ts
export class LlmFacade {
  constructor(
    private readonly providers: LlmProvider[],
    private readonly budgetPolicy: TokenBudgetPolicy,
    private readonly cache: PromptCache
  ) {}

  async completeWithFallback(request: LlmRequest, cacheKey: string): Promise<LlmResponse> {
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    await this.budgetPolicy.assertWithinBudget({ tenantId: request.tenantId, estimatedTokens: request.maxOutputTokens });
    for (const provider of this.providers) {
      try {
        const response = await provider.complete(request);
        await this.budgetPolicy.recordUsage({ tenantId: request.tenantId, ...response });
        await this.cache.set(cacheKey, response, 300);
        return response;
      } catch {
        continue;
      }
    }
    throw new Error("No LLM provider available");
  }
}
```

Controllers and domain services do not know provider SDK details, so they remain stable.

## Repository - Domain-Driven Design

Used to enforce tenant-scoped persistence and enable integration tests with test containers or in-memory fakes. It appears in `src/repositories/document.repository.ts` and `src/repositories/vector.repository.ts`.

```ts
export interface DocumentRepository {
  create(document: KnowledgeDocument): Promise<KnowledgeDocument>;
  markProcessing(tenantId: TenantId, id: DocumentId): Promise<void>;
  markIndexed(tenantId: TenantId, id: DocumentId): Promise<void>;
  saveChunks(chunks: DocumentChunk[]): Promise<void>;
  findById(tenantId: TenantId, id: DocumentId): Promise<KnowledgeDocument | null>;
}
```

It protects multi-tenancy by making `tenantId` part of persistence contracts.

## Adapter - GoF Structural

Used to wrap OpenAI, Anthropic, Pinecone, and pgvector SDKs into internal interfaces. This prevents SDK churn from leaking into services and makes provider fallbacks practical.

## Unit of Work - Enterprise Pattern

Used during ingestion to commit document status, chunks, embeddings metadata, and audit events consistently. If vector upsert fails, the worker can mark the job retryable without leaving a document incorrectly marked as indexed.

## Outbox - Enterprise Reliability Pattern

Used for audit and webhook events. The API writes outbox rows in the same transaction as domain changes; a publisher forwards events to webhooks or Kafka later. This is the same reliability instinct needed in payment orchestration systems.
