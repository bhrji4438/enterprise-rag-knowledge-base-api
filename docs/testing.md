# G. TDD Test Suite Plan

## 1. Strategy

Unit tests cover pure services, policies, prompt building, provider routing, chunking, and RBAC. Integration tests cover API flows with Supertest, test Postgres, and fake LLM adapters. E2E tests run upload -> ingestion -> query against Docker Compose. Contract tests validate OpenAPI examples and RFC 7807 errors.

## 2. Coverage Targets

Unit coverage target: 80%+. Integration coverage target: 60%+. Critical paths such as tenant isolation, token budget enforcement, and provider fallback require branch coverage.

## 3. Unit Test Examples

```ts
import { LlmFacade } from "../../src/infrastructure/llm/llm-facade";

test("returns cached LLM response before calling providers", async () => {
  const cached = { content: "cached", model: "gpt", inputTokens: 1, outputTokens: 1, costUsd: 0.001 };
  const provider = { name: "openai", complete: jest.fn() };
  const facade = new LlmFacade([provider], budget(), { get: async () => cached, set: jest.fn() });
  await expect(facade.completeWithFallback(request(), "k")).resolves.toEqual(cached);
  expect(provider.complete).not.toHaveBeenCalled();
});

test("falls back to secondary provider on primary failure", async () => {
  const good = { content: "ok", model: "claude", inputTokens: 10, outputTokens: 20, costUsd: 0.01 };
  const facade = new LlmFacade(
    [{ name: "openai", complete: jest.fn().mockRejectedValue(new Error("timeout")) }, { name: "anthropic", complete: jest.fn().mockResolvedValue(good) }],
    budget(),
    nullCache()
  );
  await expect(facade.completeWithFallback(request(), "k")).resolves.toEqual(good);
});

test("rejects calls when tenant budget is exceeded", async () => {
  const facade = new LlmFacade([{ name: "openai", complete: jest.fn() }], budget(false), nullCache());
  await expect(facade.completeWithFallback(request(), "k")).rejects.toThrow();
});

test("ingestion pipeline runs steps in order", async () => {
  const calls: string[] = [];
  const step = (name: string) => ({ name, execute: async (ctx: unknown) => { calls.push(name); return ctx; } });
  await new IngestionPipeline([step("parse"), step("chunk"), step("embed")]).run(context());
  expect(calls).toEqual(["parse", "chunk", "embed"]);
});

test("answer service hashes tenant question and context into a stable cache key", async () => {
  const llm = { completeWithFallback: jest.fn().mockResolvedValue({ content: "answer" }) };
  const retrieval = { handle: jest.fn().mockResolvedValue({ hits: [] }) };
  await new AnswerService(retrieval, llm as never).answer({ tenantId: "t1", userId: "u1", question: "Q?", topK: 3 });
  expect(llm.completeWithFallback.mock.calls[0][1]).toHaveLength(64);
});
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

Required merge checks: `npm run lint`, `npm test`, `npm run test:coverage`, `npm run build`, Docker image build, and dependency audit.
