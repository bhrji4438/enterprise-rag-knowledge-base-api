# D. Complete Folder / Project Structure

```text
.
├── .env.example                  # Annotated configuration contract (includes JWT_SECRET)
├── .github/workflows/ci.yml       # CI gate: install, lint, test, build, image
├── docker/Dockerfile              # Multi-stage production build
├── docker-compose.yml             # Local stack: app, Postgres, Redis, Ollama (with healthchecks)
├── docs/
│   ├── adr/                       # Architecture decision records
│   ├── api.md                     # OpenAPI and API standards
│   ├── ai-llm-integration.md      # LLM architecture
│   ├── design-patterns.md         # Pattern implementation guide
│   ├── devops.md                  # Deployment and operations
│   ├── project-structure.md       # This file
│   ├── system-design.md           # Architecture document
│   └── testing.md                 # TDD and CI test strategy
├── drizzle/
│   ├── 0000_thin_imperial_guard.sql  # Initial schema: documents, document_chunks, FK
│   └── 0001_indexes.sql              # Perf & isolation: tenant_id, HNSW, dedup unique
├── k8s/
│   ├── deployment.yaml            # App deployment and probes
│   ├── hpa.yaml                   # Horizontal Pod Autoscaler
│   └── service.yaml               # ClusterIP service
├── scripts/
│   ├── migrate.ts                 # Runs Drizzle migrations (enables pgvector)
│   └── seed.ts                    # Inserts demo tenant-1 data with mock vectors
└── src/
    ├── composition-root.ts        # Dependency wiring: wires all services, repos, LLM, queues
    ├── config/
    │   └── env.ts                 # Zod-validated typed config (JWT_SECRET, rate limits, budgets)
    ├── controllers/               # Thin Express adapters — one file per resource
    │   ├── auth.controller.ts     # POST /v1/auth/token (Zod-validated role enum)
    │   ├── document.controller.ts # Upload (multer), get, list, delete
    │   ├── health.controller.ts   # /health/live + /health/ready (real DB+Redis checks)
    │   ├── query.controller.ts    # POST /v1/query + /v1/query/stream (SSE)
    │   └── usage.controller.ts    # GET /v1/usage (Redis token counters)
    ├── domain/
    │   └── documents/
    │       └── entities.ts        # KnowledgeDocument, DocumentChunk, RetrievalHit value objects
    ├── infrastructure/
    │   ├── budget/
    │   │   └── token-budget.ts    # RedisTokenBudgetPolicy: enforces monthly token caps (402)
    │   ├── cache/
    │   │   ├── redis-client.ts    # IORedis singleton factory
    │   │   └── redis-prompt-cache.ts  # RedisPromptCache: namespaced JSON-serialised cache
    │   ├── db/
    │   │   ├── connection.ts      # pg.Pool + Drizzle ORM instance
    │   │   └── schema.ts          # Drizzle table definitions with pgvector(3072) column
    │   ├── llm/
    │   │   ├── llm-provider.ts    # LlmProvider + EmbeddingProvider interfaces
    │   │   ├── llm-facade.ts      # Fallback chain, cache lookup, budget enforcement
    │   │   ├── openai-provider.ts # OpenAI SDK adapter (chat + embeddings)
    │   │   ├── anthropic-provider.ts  # Anthropic raw-fetch adapter (fallback)
    │   │   └── provider-factory.ts    # Factory: OpenAI, Anthropic, MockEmbeddingProvider
    │   └── queue/
    │       └── bullmq-client.ts   # BullMQ Queue + Worker factory (URL-based connection)
    ├── repositories/
    │   ├── document.repository.ts         # DocumentRepository interface
    │   ├── drizzle-document.repository.ts # PostgreSQL implementation
    │   ├── drizzle-vector.repository.ts   # pgvector search implementation
    │   └── vector.repository.ts           # VectorRepository interface
    ├── services/
    │   ├── ingestion/
    │   │   ├── ingestion-pipeline.ts      # IngestionPipeline + PersistEmbeddingsStep
    │   │   └── steps/
    │   │       ├── sanitize.step.ts       # Strips control chars, normalises whitespace
    │   │       └── chunk.step.ts          # Token-approximate sentence-boundary chunking
    │   ├── retrieval/
    │   │   ├── retrieval-chain.ts         # BaseRetrievalHandler abstract class
    │   │   └── handlers/
    │   │       ├── embedding.handler.ts   # Embeds question via EmbeddingProvider
    │   │       └── vector-search.handler.ts  # Tenant-scoped pgvector similarity search
    │   └── qa/
    │       └── answer.service.ts          # Orchestrates retrieval + LLM; returns {answer, citations}
    ├── shared/
    │   ├── errors/
    │   │   └── problem-details.ts         # RFC 7807 ProblemDetailsError class
    │   └── middleware/
    │       ├── async-handler.ts           # Wraps async routes to forward errors to next()
    │       ├── error-handler.ts           # Global Express error handler (RFC 7807 responses)
    │       └── rbac.ts                    # requireRole(...roles) guard middleware
    └── index.ts                           # App bootstrap: middleware, RBAC routes, composition root
tests/
    ├── run-unit-tests.ts          # Dependency-light Node test harness
    └── unit/                      # Unit specs with Node assert and mocks
        └── llm-facade.test.ts     # LlmFacade cache + fallback tests
```

The layout keeps domain rules independent from Express, SDKs, and infrastructure. Every service accepts dependencies in constructors via `composition-root.ts` so tests can inject mocks without modifying production code.

