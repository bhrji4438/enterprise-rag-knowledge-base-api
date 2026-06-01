# ADR 0002: Database Selection and Data Model

## Status

Accepted

## Context

The system needs relational metadata, tenant isolation, auditability, and vector search. Running multiple databases too early increases operational cost.

## Decision

Use PostgreSQL as the system of record and pgvector for the default vector store. Keep `VectorRepository` abstract so Pinecone can be used for larger deployments.

## Consequences

Local development is simple and transactions remain strong. Very large vector workloads may need migration to a dedicated vector database.
