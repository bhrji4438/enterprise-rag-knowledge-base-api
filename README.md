# RAG Knowledge Base API

[![Build](https://github.com/mohit-gupta/rag-knowledge-base-api/actions/workflows/ci.yml/badge.svg)](https://github.com/mohit-gupta/rag-knowledge-base-api/actions)
[![Coverage](https://img.shields.io/badge/coverage-80%25+-brightgreen)](#testing)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)
[![Node](https://img.shields.io/badge/node-%3E%3D20.11.0-green)](package.json)

Enterprise-grade document ingestion, vector search, and LLM question-answering API built with Node.js, TypeScript, PostgreSQL, Redis, and provider-agnostic AI adapters. It is designed for SaaS teams that need secure tenant-isolated knowledge retrieval over private documents. The project demonstrates architecture, AI integration, security, testing, DevOps, and documentation patterns expected from a senior MERN technical lead.

```mermaid
flowchart LR
  Client[React Admin / API Client] --> API[Express TypeScript API]
  API --> Auth[JWT + RBAC + Tenant Guard]
  API --> Redis[(Redis)]
  API --> DB[(PostgreSQL + pgvector)]
  API --> Queue[BullMQ]
  Queue --> Ingest[Ingestion Workers]
  Ingest --> Embed[Embedding Strategy]
  Embed --> Vector[(pgvector / Pinecone)]
  Queue --> LLM[LLM Workers]
  LLM --> Retriever[Retrieval Chain]
  Retriever --> Vector
  LLM --> Facade[LLM Facade]
  Facade --> OpenAI[OpenAI]
  Facade --> Anthropic[Anthropic Fallback]
  API --> SSE[SSE Streaming]
  SSE --> Client
```

## Features

| Feature | Description | Status |
|---|---|---|
| Document ingestion | Upload, parse, redact, chunk, embed, index | Designed / scaffolded |
| Vector search | pgvector-first repository with Pinecone-ready contract | Designed / scaffolded |
| Streaming Q&A | Queue-backed SSE responses with citations | Designed |
| Multi-tenancy | JWT tenant claims and repository-level tenant filters | Designed |
| Cost controls | Token usage ledger, Redis prompt cache, budget caps | Designed |
| Observability | Structured logs, metrics, traces, LLM usage events | Designed |
| DevOps | Docker, Compose, Kubernetes, GitHub Actions, ArgoCD-ready | Included |

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20.11+ |
| Language | TypeScript | 5.6+ strict |
| API | Express | 4.19+ |
| AI orchestration | LangChain.js / OpenAI SDK | current |
| Database | PostgreSQL + pgvector | 16 |
| Cache/Queues | Redis + BullMQ | Redis 7 / BullMQ 5 |
| Testing | Jest + Supertest | 29 / 7 |
| Deployment | Docker + Kubernetes + ArgoCD | production-oriented |

## AI/LLM Highlights

- Full RAG flow: ingestion, chunking, embeddings, vector retrieval, reranking-ready context selection, and answer synthesis.
- Provider-agnostic `LlmFacade`, similar to Chargezoom's gateway abstraction, with OpenAI primary and Anthropic fallback.
- Queue-backed and streamed LLM calls so provider latency does not block the API hot path.
- Token budgets, prompt caching, PII redaction hooks, citation enforcement, and structured output validation.

## Design Patterns

| Pattern | Why it is used |
|---|---|
| Pipeline | Deterministic document ingestion stages |
| Chain of Responsibility | Composable retrieval and reranking steps |
| Strategy | Pluggable LLM, embedding, and vector providers |
| Facade | Single enterprise-safe LLM contract |
| Repository | Tenant-safe data access and testable persistence |
| Adapter | SDK isolation for OpenAI, Anthropic, Pinecone, pgvector |
| Outbox | Reliable audit/webhook publishing |

## Quick Start

```bash
git clone https://github.com/mohit-gupta/rag-knowledge-base-api.git
cd rag-knowledge-base-api
cp .env.example .env
npm install
docker compose up -d postgres redis
npm run migrate
npm run seed
npm run dev
```

API docs are specified in [docs/api.md](docs/api.md). Health checks are available at `GET /health/live` and `GET /health/ready`.

## Environment Variables

| Variable | Description | Required | Example |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgres://rag:rag@localhost:5432/rag_kb` |
| `REDIS_URL` | Redis connection string | Yes | `redis://localhost:6379` |
| `OPENAI_API_KEY` | OpenAI API key | Yes | `sk-...` |
| `OPENAI_CHAT_MODEL` | Primary chat model | Yes | `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | Embedding model | Yes | `text-embedding-3-large` |
| `ANTHROPIC_API_KEY` | Fallback provider key | No | `sk-ant-...` |
| `JWT_ISSUER` | JWT issuer | Yes | `rag-knowledge-base-api` |
| `JWT_AUDIENCE` | JWT audience | Yes | `rag-clients` |
| `TENANT_MONTHLY_TOKEN_BUDGET` | Default tenant token budget | Yes | `5000000` |

See [.env.example](.env.example) for the full annotated list.

## Testing

```bash
npm test
npm run test:coverage
npm run build
```

The target is 80%+ unit coverage and 60%+ integration coverage. LLM-dependent paths use provider interface mocks, not live API calls.

## Deployment

Build the image with `docker build -f docker/Dockerfile -t rag-knowledge-base-api .`. Local dependencies run with `docker compose up`. Kubernetes manifests live in [k8s](k8s), and the CI pipeline in [.github/workflows/ci.yml](.github/workflows/ci.yml) is structured for lint, test, build, push image, and GitOps deployment through ArgoCD.

## Security

The API is designed around OWASP controls: JWT auth, RBAC, tenant isolation, schema validation, rate limits, upload limits, sanitized errors, TLS-only deployment, KMS-managed secrets, audit events, prompt-injection controls, and PII redaction before provider calls.

## Documentation

- [System Design](docs/system-design.md)
- [Design Patterns](docs/design-patterns.md)
- [AI/LLM Integration](docs/ai-llm-integration.md)
- [Project Structure](docs/project-structure.md)
- [Testing Plan](docs/testing.md)
- [API Spec](docs/api.md)
- [DevOps Spec](docs/devops.md)
- [Architecture Decision Records](docs/adr)

## Contributing

Create a feature branch, keep changes small, add tests for behavior, and ensure `npm run lint`, `npm test`, and `npm run build` pass before opening a pull request. Public APIs and architectural changes should include an ADR.

## License

MIT
