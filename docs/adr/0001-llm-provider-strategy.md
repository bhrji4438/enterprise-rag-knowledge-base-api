# ADR 0001: LLM Provider Strategy and Fallback Design

## Status

Accepted

## Context

RAG answers depend on external LLM providers that can throttle, fail, or change behavior. The project must demonstrate enterprise-grade resilience similar to payment gateway routing.

## Decision

Use a provider-agnostic `LlmProvider` interface with OpenAI as primary and Anthropic as fallback for answer synthesis. Embeddings use OpenAI initially. Provider selection, retries, caching, budget enforcement, and telemetry are centralized in `LlmFacade`.

## Consequences

The application can switch providers without changing controllers or domain services. The abstraction adds upfront code but improves reliability, testability, and portfolio value.
