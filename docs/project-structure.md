# D. Complete Folder / Project Structure

```text
.
├── .env.example                  # Annotated configuration contract
├── .github/workflows/ci.yml       # CI gate: lint, test, build, image
├── docker/Dockerfile              # Multi-stage production build
├── docker-compose.yml             # Local app, Postgres, Redis
├── docs/
│   ├── adr/                       # Architecture decision records
│   ├── api.md                     # OpenAPI and API standards
│   ├── ai-llm-integration.md      # LLM architecture
│   ├── design-patterns.md         # Pattern implementation guide
│   ├── devops.md                  # Deployment and operations
│   ├── project-structure.md       # This file
│   ├── system-design.md           # Architecture document
│   └── testing.md                 # TDD and CI test strategy
├── k8s/
│   ├── deployment.yaml            # App deployment and probes
│   ├── hpa.yaml                   # Horizontal Pod Autoscaler
│   └── service.yaml               # ClusterIP service
├── src/
│   ├── config/                    # Typed env and runtime config
│   ├── controllers/               # Express route adapters
│   ├── domain/                    # Entities, policies, value objects
│   ├── infrastructure/            # DB, Redis, LLM, queue adapters
│   ├── repositories/              # Persistence contracts and implementations
│   ├── services/                  # Application use cases
│   └── shared/                    # errors, logging, validation utilities
└── tests/
    ├── unit/                      # Jest unit tests with mocks
    ├── integration/               # API and repository tests
    └── e2e/                       # Full-stack flows
```

The layout keeps domain rules independent from Express, SDKs, and infrastructure. Every service accepts dependencies in constructors so tests can inject mocks.
