# H. API Documentation Spec

## OpenAPI 3.0 Skeleton

```yaml
openapi: 3.0.3
info:
  title: RAG Knowledge Base API
  version: 1.0.0
servers:
  - url: https://api.example.com
security:
  - bearerAuth: []
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    Problem:
      type: object
      required: [type, title, status]
      properties:
        type: { type: string, example: "https://ragkb.dev/problems/validation-error" }
        title: { type: string, example: "Validation failed" }
        status: { type: integer, example: 400 }
        detail: { type: string }
        instance: { type: string }
    QueryRequest:
      type: object
      required: [question]
      properties:
        question: { type: string, example: "What is the refund policy?" }
        topK: { type: integer, example: 8 }
    QueryResponse:
      type: object
      properties:
        answer: { type: string }
        citations:
          type: array
          items:
            type: object
            properties:
              chunkId: { type: string }
              score: { type: number }
paths:
  /v1/auth/token:
    post:
      summary: Issue a JWT for a user or service account
      responses:
        "200": { description: Token issued }
  /v1/documents:
    post:
      summary: Upload a document for ingestion
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file: { type: string, format: binary }
      responses:
        "202": { description: Accepted for ingestion }
        "400": { description: Invalid upload, content: { application/problem+json: { schema: { $ref: "#/components/schemas/Problem" } } } }
    get:
      summary: List tenant documents
      responses:
        "200": { description: Document list }
  /v1/documents/{id}:
    get:
      summary: Get document metadata
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string }
      responses:
        "200": { description: Document found }
    delete:
      summary: Soft delete document and vectors
      responses:
        "204": { description: Deleted }
  /v1/query:
    post:
      summary: Ask a question against indexed knowledge
      requestBody:
        content:
          application/json:
            schema: { $ref: "#/components/schemas/QueryRequest" }
      responses:
        "200":
          description: Answer with citations
          content:
            application/json:
              schema: { $ref: "#/components/schemas/QueryResponse" }
  /v1/query/stream:
    post:
      summary: Stream an answer using Server-Sent Events
      responses:
        "200": { description: text/event-stream response }
```

## Authentication

Clients obtain JWTs from `/v1/auth/token` or use scoped API keys exchanged for JWTs. Send `Authorization: Bearer <token>` on every request. Tokens include tenant and role claims.

## Error Format

All errors use RFC 7807 `application/problem+json`, including validation, auth, rate limit, budget, provider, and conflict errors.

## Rate Limiting

Responses include `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After` for 429 responses. Clients should retry with exponential backoff and jitter.

## Webhooks

`document.indexed`, `document.failed`, and `usage.threshold_exceeded` are sent with event ID, timestamp, tenant ID, resource ID, and HMAC signature.

## Versioning

URI versioning starts with `/v1`. Breaking changes require `/v2`; non-breaking fields can be added in place.
