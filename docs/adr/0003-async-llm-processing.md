# ADR 0003: Async vs Sync Processing for LLM Calls

## Status

Accepted

## Context

LLM and embedding calls can be slow, expensive, and failure-prone. The API must remain responsive under load.

## Decision

Document ingestion and answer generation run through BullMQ workers. User-facing answers are streamed through SSE rather than blocking a normal HTTP request until completion.

## Consequences

The design needs Redis and worker deployment, but gains load shedding, retry control, observability, and better user experience.
