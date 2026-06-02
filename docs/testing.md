# G. TDD Test Suite Plan

## 1. Strategy

Unit tests cover pure services, policies, prompt building, provider routing, chunking, and RBAC. The current repository uses a dependency-light TypeScript + Node assertion harness so CI stays fast and free of deprecated Jest transitive packages. Integration tests will use Supertest, test Postgres, and fake LLM adapters. E2E tests run upload -> ingestion -> query against Docker Compose. Contract tests validate OpenAPI examples and RFC 7807 errors.

## 2. Coverage Targets

Target state: 80%+ unit coverage and 60%+ integration coverage once a coverage provider is added. Current CI enforces compile correctness and smoke unit coverage through `npm test`. Critical paths such as tenant isolation, token budget enforcement, and provider fallback require branch coverage before production release.

## 3. Unit Test Examples

```ts
import assert from "node:assert/strict";
import { LlmFacade } from "../../src/infrastructure/llm/llm-facade.js";

export async function testCachedResponsesSkipProviders(): Promise<void> {
  const cached = { content: "cached", model: "gpt", inputTokens: 1, outputTokens: 1, costUsd: 0.001 };
  const complete = asyncMock(cached);
  const provider = { name: "openai", complete };
  const facade = new LlmFacade([provider], budgetPolicy(), { get: async () => cached, set: async () => undefined });

  assert.deepEqual(await facade.completeWithFallback(request(), "k"), cached);
  assert.equal(complete.calls.length, 0);
}

export async function testFallbackToSecondaryProvider(): Promise<void> {
  const good = { content: "ok", model: "claude", inputTokens: 10, outputTokens: 20, costUsd: 0.01 };
  const primary = { name: "openai", complete: asyncMock(new Error("timeout"), true) };
  const secondary = { name: "anthropic", complete: asyncMock(good) };
  const facade = new LlmFacade([primary as never, secondary], budgetPolicy(), nullCache());

  assert.deepEqual(await facade.completeWithFallback(request(), "k"), good);
  assert.equal(secondary.complete.calls.length, 1);
}

export async function testIngestionPipelineRunsStepsInOrder(): Promise<void> {
  const calls: string[] = [];
  const step = (name: string) => ({ name, execute: async (ctx: unknown) => { calls.push(name); return ctx; } });
  await new IngestionPipeline([step("parse"), step("chunk"), step("embed")]).run(context());
  assert.deepEqual(calls, ["parse", "chunk", "embed"]);
}
```

## 4. Integration Test Examples

```ts
test("POST /v1/documents queues ingestion and returns 202", async () => {
  await request(app)
    .post("/v1/documents")
    .set("Authorization", bearerToken("admin"))
    .attach("file", Buffer.from("hello"), "kb.txt")
    .expect(202)
    .expect((res) => expect(res.body.status).toBe("uploaded"));
});

test("POST /v1/query returns answer with citations", async () => {
  await seedIndexedDocument("tenant-1");
  await request(app)
    .post("/v1/query")
    .set("Authorization", bearerToken("viewer"))
    .send({ question: "What is the refund policy?", topK: 5 })
    .expect(200)
    .expect((res) => expect(res.body.citations.length).toBeGreaterThan(0));
});
```

## 5. LLM Mocking Strategy

Provider SDKs are never imported in services. Tests mock `LlmProvider`, `EmbeddingProvider`, and `VectorRepository` interfaces. Golden prompt snapshots verify prompt shape; schema tests verify malformed provider output is rejected.

## 6. CI Gate Configuration

Required merge checks: `npm ci`, `npm run lint`, `npm test`, `npm run build`, Docker image build, and production dependency audit. `npm run test:coverage` is reserved for the future coverage provider and currently aliases `npm test`.
